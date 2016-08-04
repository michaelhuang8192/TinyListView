import React  from 'react'


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

Adapter.prototype.getViewHeader = function() {
	return null;
};

Adapter.prototype.getViewFooter = function() {
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

var ListViewItem = React.createClass({

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
		this.props.onItemClick(this.state.index, this.state.position);
	},

	render: function() {
		//console.log("render -> position" + this.state.position);
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
var ListViewBody = React.createClass({
	scrollDelay: null,
	scrollContainer: null,

	_getVirtualView: function() {
		if(this.scrollContainer == null) return null;

		var container = this.scrollContainer;
		var body = $(this.refs['body']);

		var start = Math.min(
			Math.max(0, container.scrollTop() - body.position().top),
			body.height()
		);
		var end = start + container.height();

		var startPos = Math.floor(start / this.state.rowHeight);
		var endPos = Math.ceil(end / this.state.rowHeight);

		var virtualRowsCount = Math.max(20,
			Math.ceil(container.height() / this.state.rowHeight * 1.5)
		);
		if(virtualRowsCount < this.state.virtualRowsCount)
			virtualRowsCount = this.state.virtualRowsCount;

		return {startPos: startPos, endPos: endPos, virtualRowsCount: virtualRowsCount};
	},

	_onScroll: function() {
		if(this.scrollDelay !== null) {
			clearTimeout(this.scrollDelay);
			this.scrollDelay = null;
		}

		var _this = this;
		this.scrollDelay = setTimeout(function() {
			//console.log("_onScroll");
			var virtualView = _this._getVirtualView();
			if(virtualView == null) return;
			if(virtualView.startPos != _this.state.startPos
				|| virtualView.endPos != _this.state.endPos
				|| virtualView.virtualRowsCount != _this.state.virtualRowsCount
			)
				_this.setState(virtualView);

		}, 50);

	},

	_onResize: function() {
		this._onScroll();
	},

	_change: function() {
		this.setState({
			rowsCount: this.props.adapter.getCount(),
			version: this.state.version + 1
		});
	},

	_onClick: function(index, position) {
		if(position != this.state.curPosition) {
			this.setState({curPosition: position});
		}

	},

	shouldComponentUpdate: function(nextProps) {
		if(nextProps.shouldNotRender)
			return false;
		return true;
	},

	componentWillMount: function() {
		this.setState({
			rowHeight: 0,
			virtualRowsCount: 0,
			startPos: 0,
			endPos: 0,
			rowsCount: 0,
			version: 0,
			curPosition: -1
		});
	},

	render: function() {
		var rows = [];
		if(this.state.rowHeight <= 0) {
			rows.push(<div key={-1} className="tlv_row" ref="hidden_row" style={{visibility: 'hidden'}}></div>);
		} else {
			var virtualRowsCount = this.state.virtualRowsCount;
			var positions = new Array(virtualRowsCount);
			var endpos = Math.min(this.state.rowsCount, this.state.endPos);
			for(var i = this.state.startPos; i < endpos; i++) {
				positions[i % virtualRowsCount] = i;
			}

			for(var i = 0; i < virtualRowsCount; i++) {
				var position = positions[i] === undefined ? -1 : positions[i];
				var selected = position >= 0 && this.state.curPosition == position;
				rows.push(
				<ListViewItem
					adapter={this.props.adapter}
					key={i} ref={'vrow' + i}
					index={i}
					position={position}
					selected={selected}
					version={this.state.version}
					rowHeight={this.state.rowHeight}
					onItemClick={this._onClick} />
				);
			}
		}

		var height = this.state.rowHeight * this.state.rowsCount;
		var style = $.extend({}, this.props.style || {}, {height: height + "px"});

		var className = this.props.className != null ? "tlv_body " + this.props.className : "tlv_body";
		return (<div className={className} ref="body" style={style}>{rows}</div>);

	},

	parentDidMount: function(scrollContainer) {
		this.scrollContainer = $(scrollContainer);

		var container = this.scrollContainer;
		var rowHeight = $(this.refs['hidden_row']).outerHeight();
		if(rowHeight <= 0) rowHeight = DEFAULT_ROW_HEIGHT;
		this.state.rowHeight = rowHeight;
		
		var virtualView = this._getVirtualView();
		this.state.startPos = virtualView.startPos;
		this.state.endPos = virtualView.endPos;
		this.state.virtualRowsCount = virtualView.virtualRowsCount;
		
		this.props.adapter.registerDataSetObserver(this._change);
	},

	parentWillUnmount: function() {
		this.props.adapter.unregisterDataSetObserver(this._change);

		if(this.scrollDelay !== null) {
			clearTimeout(this.scrollDelay);
			this.scrollDelay = null;
		}

		this.scrollContainer = null;
	}

});

var ListView = React.createClass({
	scrollLeft: 0,

	_onScrollLeft: function() {
		var container = $(this.refs['scrollContainer']);
		var left = container.scrollLeft();
		if(left == this.scrollLeft) return;
		this.scrollLeft = left;

		var header = this.refs['header'];
		if(header && header.isScrollable && header.isScrollable()) {
			$(this.refs['headerCnt']).css('left', -left + "px");
		}

		var footer = this.refs['footer'];
		if(footer && footer.isScrollable && footer.isScrollable()) {
			$(this.refs['footerCnt']).css('left', -left + "px");
		}
	},

	_onScroll: function(evt) {
		this.refs['listViewBody']._onScroll(evt);
		this._onScrollLeft();
	},

	_onResize: function(evt) {
		this.refs['listViewBody']._onResize(evt);
	},

	render: function() {
		var header = this.props.adapter.getViewHeader();
		var footer = this.props.adapter.getViewFooter();

		var className = this.props.className != null ? "tinylistview " + this.props.className : "tinylistview";
		var style = $.extend({}, this.props.style || {});
		return (
		<div className={className} style={style}>
			<div key="header" ref="headerCnt" className="tlv_row tlv_header" style={{display: header == null ? 'none' : 'block'}}>
				{header && React.cloneElement(header, {adapter: this.props.adapter, ref: "header"})}
			</div>
			<div key="body" className="tlv_scroll_containter" ref="scrollContainer">
				<div style={{position: 'relative'}}><ListViewBody adapter={this.props.adapter} ref="listViewBody" /></div>
			</div>
			<div key="footer" ref="footerCnt" className="tlv_row tlv_footer" style={{display: footer == null ? 'none' : 'block'}}>
				{footer && React.cloneElement(footer, {adapter: this.props.adapter, ref: "footer"})}
			</div>
		</div>
		);

	},

	componentDidMount: function() {
		$(window).on('resize', this._onResize);
		$(this.refs['scrollContainer']).on('scroll', this._onScroll);
		this.refs['listViewBody'].parentDidMount(this.refs['scrollContainer']);
	},

	componentWillUnmount: function() {
		$(window).off('resize', this._onResize);
		$(this.refs['scrollContainer']).off('scroll', this._onScroll);
		this.refs['listViewBody'].parentWillUnmount();
	}

});

module.exports = {
	ListView: ListView,
	ListViewBody: ListViewBody,
	AjaxAdapter: AjaxAdapter,
	ArrayAdapter: ArrayAdapter,
	Adapter: Adapter
};