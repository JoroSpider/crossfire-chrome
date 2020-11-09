(function(document){
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      switch (request.name) {
      case "getPreferences":
        var value = localStorage["mode"];
		if (!value) { value = "default"; };
		let modValue = localStorage['modifier'];
		if (!modValue) { modValue = 'default'; }
        sendResponse({mode: value, modifier: modValue});
        break;
      }
    }
  );
})(document);
