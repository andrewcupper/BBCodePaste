// BBCodePaste
// Authored by David W. Jeske
// Licensed as free open-source in the Public Domain

// how to access current page from background
// http://stackoverflow.com/questions/2779579/in-background-html-how-can-i-access-current-web-page-to-get-dom

// NOTE: We use a background back to read from the clipboard, and then pass the content to the 
// in-page content_script using message passing. 
// 
// NOTE: It looks like as of sometime in 2014, it should be possible to read/write the clipboard directly from a 
// content_script.
// https://bugs.chromium.org/p/chromium/issues/detail?id=395376
//
// NOTE: This page reads from the clipboard and sends to the page context. If you are going the other direction,
// reading formatted HTML from the page and sending it to the clipboard, you would want to use execCommand('copy')
// directly inside content_script, NOT by sending it to a background page. That's because using a background page
// would require injecting "untrusted" html directly into your background page DOM, where it would
// have access to the elevated permissions of the background page.

function OutputStream() {
  this.string = "";
  this.add = function(content) { this.string += content; };
}


function convertHTMLToBBCode(textinput) {
  var myStream = new OutputStream();
  var myHTMLEmitter = new HTMLParseEmitter(myStream);

  HTMLParseContent(textinput,myHTMLEmitter);

  return myStream.string;
}

// <b> test <i> italics </i></b>

function bbCodeTagMapper(node, os) {
   var bbcodetag = null;

   switch(node.nodeName.toUpperCase()) {
     case "#TEXT":
        console.log("BBCodePaste:   textnode : " + node.nodeValue);
        os.add(node.nodeValue);
        break;
     case "B":
        os.add("[B]");
        bbcodetag = "B";
        break;
     case "I":
        os.add("[I]");
        bbcodetag = "I";
        break;
     case "U":
        os.add("[U]");
        bbcodetag = "U";
        break;
     case "UL":
        os.add("[LIST]");
        bbcodetag = "LIST";
        break;
     case "LI":
        os.add("[*]");
        bbcodetag = "*";
        break;
     case "OL":
        os.add("[LIST=]");
        bbcodetag = "*";
        break;
     case "A":
        os.add("[URL=" + node.href + "]");
        bbcodetag = "URL";
        break;
     case "IMG":
        os.add("[IMG=" + node.src + "]");
        bbcodetag = "IMG";
        break;
     case "PRE":
        os.add("[CODE]");
        bbcodetag = "CODE";
        break;
   }

   return bbcodetag;
}

function walkChildrenOf(node, os) {
   var bbcodetag = bbCodeTagMapper(node, os);
   
   // walk children...
   var subnode = node.firstChild;
   while(subnode) {
      walkChildrenOf(subnode, os);
      subnode = subnode.nextSibling;
   }

   // add the end of the bbcode tag...
   if (bbcodetag != null) {
      os.add("[/" + bbcodetag + "]");
   }
  

   console.log("BBCodePaste: endtag : " + node.nodeName);
}

function bbcodePasteHandler(info, tab) {	
   // grab the clipboard data...
   bg = chrome.extension.getBackgroundPage();

   bg.document.body.innerHTML= ""; // clear the background page

   var helper = null;
   var helperdiv = null;
   

   if (helper == null) {
	   helper = bg.document.createElement("textarea");
	   helper.style.position = "absolute";
	   helper.style.border = "none";
	   // helper.style.fontSize = "1pt";
	   // helper.style.margin = "-100";
	   document.body.appendChild(helper);
   }
   if (helperdiv == null) {
	   helperdiv = bg.document.createElement("div");
           document.body.appendChild(helperdiv);
           helperdiv.contentEditable = true;
   }
   
   if (false) {
    // this grab plain text from the clipboard
    helper.select(); 
    bg.document.execCommand("Paste");
    
    var data = helper.value;
    console.log("bbcode paste clipboard data: " + data);

    helperdiv.innerHTML = data;
    console.log("innerText = " + helperdiv.innerText);
   } else {
    // this will grab HTML formatted text from the clipboard
    helperdiv.innerHTML=""; // clear the buffer    
    var range = document.createRange();
    range.selectNode(helperdiv);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    helperdiv.focus();    
    bg.document.execCommand("Paste");
    console.log("innerHTML = " + helperdiv.innerHTML);
   }

   

   // iterate the tags...
   
   var myConvertedOutputStream = new OutputStream();
   walkChildrenOf(helperdiv, myConvertedOutputStream);

   // convert the clipboard contents to BBCode...

   // var convertedData = convertHTMLToBBCode(data);
   // var convertedData = helperdiv.innerText;
   var convertedData = myConvertedOutputStream.string;

   // send the data to the page...
   chrome.tabs.sendMessage(tab.id, {method: "getSelection", data: convertedData }, function(response) {
	  if (response) { 
		  console.log("BBCodePaste response: " + JSON.stringify(response));
	  } else {
      console.log("BBCodePaste empty response");
      alert("BBCodePaste couldn't talk to page helper. Check extension settings.")
	  
	  }
	});
   
}


chrome.extension.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(msg) {
      // do nothing...
    });
});

chrome.extension.onRequest.addListener(function(request,sender,sendResponse) {
  // do nothing...
});

chrome.contextMenus.create(
     {"title" : "BBCode Paste",
      "id" : "BBCodePaste_context_menu",
      "onclick" : bbcodePasteHandler,
      "contexts" : ["editable"]      
    });

// A generic onclick callback function.

/* 

function genericOnClick(info, tab) {
  console.log("item " + info.menuItemId + " was clicked");
  console.log("info: " + JSON.stringify(info));
  console.log("tab: " + JSON.stringify(tab));
  
	chrome.tabs.sendMessage(tab.id, {method: "getSelection", data: "test123" }, function(response) {
	  if (response) {       
		  console.log("BBCodePaste response: " + response);
	  } else {
	  	  console.log("empty response");
	  }
	});

}

chrome.contextMenus.create(
     {"title" : "BBCode Test",
      "contexts" : ["editable"],
      "onclick" : genericOnClick });

*/
      
    

// NOTES solving problem with context menu not appearing in incognito
//
//  http://stackoverflow.com/questions/21075987/chrome-extension-context-menu-does-not-persist