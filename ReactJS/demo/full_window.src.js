import React  from 'react'
import ReactDOM from 'react-dom'
import {ListView, AjaxAdapter} from '../../../src/TinyListView'


var adapter = new AjaxAdapter({
	url: '/api/Samples/getAFDEmo'
});


adapter.getView = function(position) {
	var item = this.getItem(position);

	if(item == null) {
		return (
			<div>
				<div>#{position + 1}</div>
				<div><img src="loading.gif" alt="" /></div>
				<div></div>
			</div>
		);
	} else {
		return (
			<div>
				<div>#{position + 1}</div>
				<div><img src={item.imageSrc} alt="" /></div>
				<div>{item.name}</div>
			</div>
		);
	}

};

var Header = React.createClass({
	render() {
		return (
			<div className="tlv_row tlv_header" ref="header">
				<div>
					<div>Row</div>
					<div>Image</div>
					<div>Desc</div>
				</div>
			</div>
		);
	}
});

var Footer = React.createClass({
	shouldScrollLeft() {
		return false;
	},

	render() {
		var gv = this.props.ctx;

		return (
			<div className="tlv_footer">
				{gv.state.startPos} - {Math.min(gv.state.endPos, gv.state.rowsCount)} of {gv.state.rowsCount} (Powered By <a href="/web/projects/tiny-list-view" target="_blank">TinyListView.JS</a>)
			</div>
		);
	}
});

var DemoListView = React.createClass({
	render() {
		return (
				<ListView
					ref="listView"
					adapter={adapter}
					outterScroll={true}
					Header={Header}
					Footer={Footer}
					/>
		);
	}
});

$(function() {
	
ReactDOM.render(
	<DemoListView />,
	document.getElementById('app')
);

});

