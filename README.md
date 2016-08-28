# TinyListView
Displays a huge data set with a few resources. And this list view solves the problem of slow response in the browser when there's so many items in a single page.


# Usage

For ReactJS
```
var adapter = ArrayAdapter([1, 2, 3]); // Local data
var adapter = AjaxAdapter({url: 'API_URL'}); // Remote data. Server Request Url: API_URL?pageIndex=FROM_IDX&pageSize=NUM_PER_PAGE

// item row render
adapter.getView = (position)=> {
	var item = this.getItem(position);
	if(item == null) return <div></div>;
	return (
		<div><div>{item.link}</div></div>
	);
};

var Header = React.createClass({
	render() {
		return (
			<div className="tlv_row tlv_header" ref="header">
				<div><div>Link</div></div>
			</div>
		);
	}
});

var Footer = React.createClass({
	shouldScrollLeft() {
		return false;
	},

	render() {
		return <div className="tlv_footer">Footer</div>;
	}
});

// render
<ListView 
  adapter={adapter}
  outterScroll={true} //optional, respone to main window's scrolling. default: false
  className={className}
  Header={Header} //optional
  Footer={Footer} //optional
  onItemClick={this.onItemClick} //optional
/>

//method:
updateUI(); //should call after any implicit resizing.
```

For Jquery
```
$('#datagrid').tinygrid({
len: 1,
src: {page:'API_URL'}, //Server Request URL: API_URL?pagesize=NUM_PER_PAGE&sidx=FROM_PAGE_IDX&eidx=TO_PAGE_IDX
cols: [{name:'Image', width:100, ctrlname:'image'},
       {name:'Name', width:"70%",},
       {name:'Cate', width:"30%",},
       {name:'Lowest', width:100,},
       {name:'Highest', width:100,},
       {name:'Date', width:300,},
       ],
});

```

# License
Free
