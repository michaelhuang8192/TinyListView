import React  from 'react'
import ReactDOM from 'react-dom'

function Adapter() {
	this._observers = [];

}

Adapter.prototype.getCount = function() {
	return 0;
};

Adapter.prototype.getItem = function(position) {
	return null;
};

Adapter.prototype.getView = function(position) {
	return null;
};

Adapter.prototype.registerDataSetObserver = function(observer) {
	if(this._observers.indexOf(observer) >= 0) return;

	this._observers.push(observer);
	observer();
};

Adapter.prototype.unregisterDataSetObserver = function(observer) {
	var idx = this._observers.indexOf(observer);
	if(idx >= 0)
		this._observers.splice(idx, 1);
};

Adapter.prototype.notifyDataSetChanged = function() {
	for(var i = 0; i < this._observers.length; i++)
		this._observers[i]();
};


function ArrayAdapter(arrayList) {
	Adapter.call(this);
	this.arrayList = arrayList || [];
}

ArrayAdapter.prototype = Object.create(Adapter.prototype);
ArrayAdapter.prototype.constructor = ArrayAdapter;

ArrayAdapter.prototype.getCount = function() {
	return this.arrayList.length;
};

ArrayAdapter.prototype.getItem = function(position) {
	return this.arrayList[position];
};


function AjaxAdapter(cfg) {
	Adapter.call(this);

	this.cfg = $.extend({}, cfg || {});
	this.cfg.pageSize = this.cfg.pageSize || 50;

	this._total = 1;
	this._pages = {};

	this._failed = 0;

	this._ajaxRequest = null;
}

AjaxAdapter.prototype = Object.create(Adapter.prototype);
AjaxAdapter.prototype.constructor = AjaxAdapter;

AjaxAdapter.prototype.getCount = function() {
	return this._total;
};

AjaxAdapter.prototype.clear = function(shouldNotNotify) {
	this._total = 0;
	this._pages = {};
	this._failed = 0;
	if(this._ajaxRequest != null) {
		this._ajaxRequest.abort();
		this._ajaxRequest = null;
	}
	shouldNotNotify || this.notifyDataSetChanged();
};

AjaxAdapter.prototype.refresh = function(shouldNotNotify) {
	this.clear(true);
	this._total = 1;
	shouldNotNotify || this.notifyDataSetChanged();
};

AjaxAdapter.prototype.getItem = function(position) {
	var pageSize = this.cfg.pageSize;
	var pageIndex = Math.floor(position / pageSize);
	var rowIndex = position % pageSize;
	var page = this._pages[pageIndex];

	if(page === null) return null;
	if(page === undefined) {
		if(pageIndex >= 0) this.loadPage(pageIndex);
		return null;
	}

	return page[rowIndex];
};

AjaxAdapter.prototype.onData = function(pageIndex, data) {
	var total = data.total;
	var pages = data.pages;

	if(this._total != total) {
		this._pages = {};
	}

	this._total = total;
	this._pages[pageIndex] = pages[pageIndex] === undefined ? null : pages[pageIndex];
};



AjaxAdapter.prototype.loadPage = function(pageIndex) {
	if(this._ajaxRequest != null) return;

	var params = $.extend(
		{},
		this.cfg.params,
		{pageIndex: pageIndex, pageSize: this.cfg.pageSize}
	);
	if(this.cfg.method == 'post')
		this._ajaxRequest = $.post(this.cfg.url, params, null, 'json');
	else
		this._ajaxRequest = $.get(this.cfg.url, params, null, 'json');

	var _this = this;
	this._ajaxRequest.done(function(data, textStatus, jqXHR) {
		_this.onData(pageIndex, data);
		_this._failed = 0;

	}).fail(function(jqXHR, textStatus, errorThrown) {
		_this._failed++;
		console.log("Failed -> " + errorThrown);

	}).always(function() {
		_this._ajaxRequest = null;
		if(_this._failed <= 2)
			_this.notifyDataSetChanged();

	});

};

var ViewItem = React.createClass({

	componentWillMount: function() {
		this.setState({
			position: this.props.position,
			selected: this.props.selected
		});
	},

	componentWillReceiveProps(nextProps) {
		if(nextProps.version != this.props.version || nextProps.position >= 0) {
			this.setState({
				position: nextProps.position,
				selected: nextProps.selected
			});
		}

	},

	shouldComponentUpdate(nextProps, nextState) {
		if(nextProps.version != this.props.version) {
			return true;
		} else if(nextState.position != this.state.position 
			|| nextState.selected != this.state.selected)
		{
			return true;
		}

		return false;
	},

	_onClick: function() { 
		this.props.onItemClick(this.state.position);
	},

	render: function() {
		var className = "tlv_row";
		if(this.state.selected) className += " tlv_item_active";

		var row = this.props.adapter.getView(this.state.position);
		var style = {
			top: (this.props.rowHeight * this.state.position) + "px",
			display: this.state.position < 0 ? 'none' : 'block'
		};
		return (
			<div style={style} className={className} onClick={this._onClick}>{row}</div>
		);
	}

});

var DEFAULT_ROW_HEIGHT = 40;
var ListView = React.createClass({
	scrollDelay: null,
	scrollContainer: null,
	rowHeight: 0,
	virtualRowsCount: 0,

	__measure() {
		var rowHeight = $(this.refs['hidden_row']).height() || DEFAULT_ROW_HEIGHT;
		var body = $(this.refs['body']);
		var bodyPosTop = this.props.outterScroll ? body.offset().top : 0;
		var containerHeight = this.scrollContainer.height() + 30;
		
		if(containerHeight == this.containerHeight
			&& bodyPosTop == this.bodyPosTop
			&& rowHeight == this.rowHeight
		)
			return false;
		
		this.rowHeight = rowHeight;
		this.containerHeight = containerHeight;
		this.bodyPosTop = bodyPosTop;

		var numItemPerContainer = Math.ceil(containerHeight / this.rowHeight) + 1;
		this.virtualRowsCount = Math.max(
			Math.max(20, (Math.ceil(numItemPerContainer * 1.5) + 1) & ~1 ),
			this.virtualRowsCount
		);

		return true;
	},

	_onResize: function() {
		if(this.props.paused) return;

		if(this.__measure()) {
			this.setState(
				$.extend({}, this._getVirtualView(), {version: this.state.version + 1})
			);
		} else {
			var virtualView = this._getVirtualView();
			if(virtualView.startPos != this.state.startPos
				|| virtualView.endPos != this.state.endPos)
				this.setState(virtualView);
		}
	},

	updateUI: function() {
		this._onResize();
	},

	_getVirtualView: function() {
		if(this.scrollContainer == null) return null;

		var container = this.scrollContainer;
		var body = $(this.refs['body']);

		var start = Math.min(
			Math.max(0, container.scrollTop() - this.bodyPosTop),
			body.height()
		);
		var end = start + this.containerHeight;

		var startPos = Math.floor(start / this.rowHeight);
		var endPos = Math.ceil(end / this.rowHeight);

		return {
			startPos: startPos, 
			endPos: endPos
		};
	},

	_onScroll: function() {
		var scrollLeft = this.scrollContainer.scrollLeft();
		var header = this.refs['header'];
		if(header != null && (header.shouldScrollLeft == null || header.shouldScrollLeft() != false))
			$(ReactDOM.findDOMNode(header)).css('left', -scrollLeft + "px");
		var footer = this.refs['footer'];
		if(footer != null && (footer.shouldScrollLeft == null || footer.shouldScrollLeft() != false))
			$(ReactDOM.findDOMNode(header)).css('left', -scrollLeft + "px");

		if(this.props.paused) return;
		if(this.scrollDelay !== null) return;

		var _this = this;
		this.scrollDelay = setTimeout(function() {
			_this.scrollDelay = null;
			if(_this.props.paused) return;

			var virtualView = _this._getVirtualView();
			if(virtualView == null) return;

			if(virtualView.startPos != _this.state.startPos
				|| virtualView.endPos != _this.state.endPos)
				_this.setState(virtualView);

		}, 50);

	},

	_change: function() {
		this.setState({
			rowsCount: this.props.adapter.getCount(),
			version: this.state.version + 1
		});
	},

	_onClick: function(position) {
		if(position != this.state.curPosition) {
			this.setState({curPosition: position});
		}

		this.props.onItemClick && this.props.onItemClick(position);
	},

	shouldComponentUpdate: function(nextProps) {
		if(nextProps.paused)
			return false;
		return true;
	},

	componentWillMount: function() {
		this.setState({
			startPos: 0,
			endPos: 0,
			rowsCount: 0,
			version: 0,
			curPosition: -1
		});
	},

	render: function() {
		var rows = [];
		rows.push(<div key={-1} className="tlv_row" ref="hidden_row" style={{visibility: 'hidden', left: 0, top: 0}}></div>);
		
		if(this.virtualRowsCount) {
			var virtualRowsCount = this.virtualRowsCount;
			var positions = new Array(virtualRowsCount);
			var endpos = Math.min(this.state.rowsCount, this.state.endPos);
			for(var i = this.state.startPos; i < endpos; i++) {
				positions[i % virtualRowsCount] = i;
			}

			for(var i = 0; i < virtualRowsCount; i++) {
				var position = positions[i] === undefined ? -1 : positions[i];
				var selected = position >= 0 && this.state.curPosition == position;
				rows.push(
				<ViewItem
					adapter={this.props.adapter}
					key={i} ref={'vrow' + i}
					position={position}
					selected={selected}
					version={this.state.version}
					rowHeight={this.rowHeight}
					onItemClick={this._onClick} />
				);
			}
		}

		var height = this.rowHeight * this.state.rowsCount;
		var style = $.extend({}, this.props.style || {}, {height: height + "px"});

		var classNames = ["tinylistview"];
		if(!this.props.outterScroll) classNames.push("tinylistview_innerscroll");
		if(this.props.className) classNames.push(this.props.className);

		var customViews = [];
		if(this.props.Header) {
			var Header = this.props.Header;
			customViews.push(<Header ref="header" ctx={this} />);
		}
		if(this.props.Footer) {
			var Footer = this.props.Footer;
			customViews.push(<Footer ref="footer" ctx={this} />);
		}

		return (
		<div className={classNames.join(" ")}>
			<div className="tlv_container" ref="scrollContainer">
				<div className="tlv_body" ref="body" style={style}>{rows}</div>
			</div>
			{customViews}
		</div>
		);

	},

	componentDidMount: function() {
		this.scrollContainer = this.props.outterScroll ? $(window) : $(this.refs['scrollContainer']);
		
		$(window).on('resize', this._onResize);
		this.scrollContainer.on('scroll', this._onScroll);

		this.__measure();

		var virtualView = this._getVirtualView();
		this.state.startPos = virtualView.startPos;
		this.state.endPos = virtualView.endPos;
		
		this.props.adapter.registerDataSetObserver(this._change);
	},

	componentWillUnmount: function() {
		$(window).off('resize', this._onResize);
		this.scrollContainer.off('scroll', this._onScroll);

		this.props.adapter.unregisterDataSetObserver(this._change);

		if(this.scrollDelay !== null) {
			clearTimeout(this.scrollDelay);
			this.scrollDelay = null;
		}

		this.scrollContainer = null;
	}

});


module.exports = {
	ListView: ListView,
	AjaxAdapter: AjaxAdapter,
	ArrayAdapter: ArrayAdapter
};