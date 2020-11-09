(function(document) {
   document.addEventListener('DOMContentLoaded', function(e) {
      document.getElementById("button").addEventListener('click', function(e) {
         e.preventDefault();
         save_options();
      }, false);

      restore_options();
   }, false);


   function save_options()
    {
      var select = document.getElementById("mode");
	  localStorage["mode"] = select.value;
	  const modifierSelect = document.getElementById('modifier');
	  localStorage['modifier'] = modifierSelect.value;
      var status = document.getElementById("status");
      status.innerHTML = "Settings have been saved.";
      setTimeout(function(e) {
        status.innerHTML = "";
      }, 1500);
    }

    function restore_options()
    {
      var mode = localStorage["mode"];
      if (!mode) { return; }
	  var select = document.getElementById("mode");
	  const modifier = localStorage['modifier'];
	  if (!modifier) { return; }
	  const modifierSelect = document.getElementById('modifier');
	  select.value = mode;
	  modifierSelect.value = modifier;
    }
})(document);
