(function () {
	var MAX_RESULTS = 1000;
	var $ = function (id) {return document.getElementById(id);};
	var input = $("regexp-input"),
		textEl = $("text-editor"),
		resultsEl = $("matches-list"),
		previewEl = $("results-preview"),
		resultsTitleEl = $("matches-header");

	var worker = null, store = null;

	// create worker from blob
	var typedArray = [(regexWorker+"").replace(/function \(\) \{/,"").replace(/\}[^}]*$/, "")];
	var blob = new Blob([typedArray], {type: "text/javascript"}); // pass a useful mime type here
	var blobUrl = URL.createObjectURL(blob);

	var key = "apiKey=eHom4izItOoREUUPRPKfBNwzQdDlO-62";
	store = new MongoStore("instant-re", "snippets", key);

	var snippet = {
		re : "",
		text : ""
	};

	var load = function (re, text) {
		input.value = re;
		textEl.textContent = text;
		refresh();
	};

	var escape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	};

	var unescape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&gt;/g, ">").replace(/\&lt;/g, "<").replace(/\&amp;/g, "&");
	};

	var messageHideTimer;
	var displayMessage = function (message) {
		$("head-drop-message").innerHTML = escape(message);
		$("head-drop-message").classList.remove("head-drop-message-hidden");
		
		window.clearTimeout(messageHideTimer);
		messageHideTimer = window.setTimeout(hideMessage, 4000);
	};

	var hideMessage = function () {
		window.clearTimeout(messageHideTimer);
		$("head-drop-message").classList.add("head-drop-message-hidden");
	}

	var unhighlight = function () {
		// remove highlighting
		textEl.innerHTML = escape(unescape(textEl.textContent));
	}

	var gotoErrorState = function (message) {
		input.classList.add("input-error");
		previewEl.classList.add("out-of-date");
		unhighlight();
		if (window.getSelection().focusNode == textEl) {
			console.log(currentPos);
			moveCaret(textEl, currentPos.begin, currentPos.end);
		}
		displayMessage(message);
	};

	var leaveErrorState = function () {
		input.classList.remove("input-error");
		previewEl.classList.remove("out-of-date");
		hideMessage();
	};

	var parseRe = function (reString) {
		// force re to be global
		if(/^\/.*\/(g|i)*\s*$/.test(reString)) {
			if(/\/i?\s*$/.test(reString)) {
				reString = reString + "g";
			}
		} else {
			reString = "/" + reString + "/g";
		}
		try {
			eval("var re = " + reString);	
			leaveErrorState();
			return re;
		} catch (e) {
			gotoErrorState("invalid regular expression : " + reString);
		}
	};

	var getCurrentCaretPos = function () {
		return {
			begin : textEl.selectionStart,
			end : textEl.selectionEnd
		};
	};

	var moveCaret = function (pre, begin, end) {
		pre.setSelectionRange(begin, typeof end == "undefined" ? begin:end);
	};

	var killWorker = function () {
		worker.terminate();
		worker = null;
	};

	var safetyTimer, inProgressTimer;
	var refresh = function(){
		saveToLocalStorage();
		// No refresh if empty regex (TODO:Remove errors)
		if(input.value.length == 0) {
			resultsEl.innerHTML = "";
			updateResultsTitle(0)
			unhighlight();
		} else {
			var userRe = parseRe(input.value);
			var text = unescape(textEl.textContent);

			if (userRe) {
				window.clearTimeout(inProgressTimer);
				window.clearTimeout(safetyTimer);

				if (worker) killWorker();

				worker = new Worker(blobUrl);
				worker.onmessage = onWorkerSuccess;

				worker.postMessage({
					userRe : userRe,
					text : text
				});

				inProgressTimer = window.setTimeout(displayInProgressIndicator, 100);
				safetyTimer = window.setTimeout(onWorkerBlock, 3000);
			}
		}
	};
	var currentPos={};
	var onWorkerSuccess = function (event) {
		var data = event.data;
		window.clearTimeout(inProgressTimer);
		window.clearTimeout(safetyTimer);
		resultsEl.innerHTML = data.resultsHTML;
		textEl.innerHTML = data.textHTML;
		if (window.getSelection().focusNode == textEl) {
			console.log(currentPos);
			moveCaret(textEl, currentPos.begin, currentPos.end);
		}
		updateResultsTitle(data.resultsLength);

		// ERROR/PROGRESS -> SUCCESS
		input.classList.remove("in-progress");
		hideMessage();
	};

	var onWorkerBlock = function () {
		window.clearTimeout(inProgressTimer);
		killWorker();
		input.classList.remove("in-progress");
		gotoErrorState("ERROR : Could not process regular expression");
	};

	var displayInProgressIndicator = function () {
		// SUCCESS/ERROR -> PROGRESS
		input.classList.add("in-progress");
		displayMessage("Processing regular expression");
	};

	var updateResultsTitle = function (resultsCount) {
		var resultTitle;
		if (resultsCount > 0) {
			if (resultsCount >= MAX_RESULTS) {
				resultTitle =  "More than " + MAX_RESULTS + " matches found";
			} else {
				resultTitle =  resultsCount + (resultsCount>1 ? " matches found" : " match found");
			}
		} else {
			resultTitle = "No matches";
		}
		resultsTitleEl.innerHTML = resultTitle;
	};

	var saveToLocalStorage = function () {
		var text = unescape(textEl.textContent);
		window.localStorage.instantReSnapshot = JSON.stringify({
			"re" : input.value,
			"text" : text
		});
	};

	var KEYCODE = {
		ENTER : 13,
		TAB : 9
	};

	var onPreKeydown = function (evt) {
		var caretPos = getCurrentCaretPos();
		var	text = textEl.textContent;
		if (evt.keyCode == KEYCODE.ENTER) {									
			textEl.textContent = text.substring(0, caretPos.begin) + "\n" + text.substring(caretPos.end);
			
			currentPos = {begin : caretPos.begin+1, end : caretPos.begin+1};
			refresh();
			moveCaret(textEl, caretPos.begin+1);

			evt.preventDefault();
		} else if (evt.keyCode == KEYCODE.TAB) {
			textEl.textContent = text.substring(0, caretPos.begin) + (new Array(5)).join(" ") + text.substring(caretPos.end);
			currentPos = {begin : caretPos.begin+4, end : caretPos.begin+4};
			refresh();
			moveCaret(textEl, caretPos.begin+4);

			evt.preventDefault();
		}
		
	};

	var onPreKeyup = function (evt) {	
		if ([KEYCODE.ENTER, KEYCODE.TAB].indexOf(evt.keyCode) != -1) return;
		var caretPos = getCurrentCaretPos();
		currentPos = {begin : caretPos.begin, end : caretPos.end};
		refresh();
	};
	

	var clear = function () {
		if (confirm("Reset your workspace ?")){
			load("", "");
		}
	};
	// if using keydown, I don't have the value directly in the input field. 
	// Would need to either : 
	// 1 : timeout
	// 2 : store the RE somewhere else
	input.addEventListener("keyup", refresh);
	textEl.addEventListener("keydown", onPreKeydown);
	textEl.addEventListener("keyup", onPreKeyup);
	document.getElementsByClassName("head-logo")[0].addEventListener("click", clear);

	if (window.localStorage.instantReSnapshot) {
		eval("var snippet = " + window.localStorage.instantReSnapshot);
		load(snippet.re, snippet.text);
		input.focus();
	}
})();