(function () {
	var MAX_RESULTS = 1000;
	var $ = function (id) {return document.getElementById(id);};
	var input = $("regexp-input"),
		editorEl = $("text-editor"),
		resultsEl = $("matches-list"),
		previewEl = $("results-preview"),
		resultsTitleEl = $("matches-header");

	var worker = null,
		snippet = {
		re : "",
		text : ""
	};

	var load = function (re, text) {
		input.value = re;
		editorEl.textContent = text;
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
	};

	var unhighlight = function (forceText) {
		updateEditor(escape(unescape(forceText || editorEl.textContent)));
	};

	var editorHasFocus = function () {
		return editorEl.contains(window.getSelection().focusNode);
	};

	var gotoErrorState = function (message) {
		input.classList.add("input-error");
		previewEl.classList.add("out-of-date");
		unhighlight();
		if (editorHasFocus()) {
			moveEditorCaret(currentPos.begin, currentPos.end);
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
			begin : editorEl.selectionStart,
			end : editorEl.selectionEnd
		};
	};

	var moveEditorCaret = function (begin, end) {
		editorEl.setSelectionRange(begin, typeof end == "undefined" ? begin:end);
	};

	window.jumpToIndex = function (index) {
		moveEditorCaret(index);
	};

	var terminateCurrentWorker = function () {
		if (worker) worker.terminate();
	};

	var offDomReplaceHTML = function (el, html) {
		var p = el.parentNode;
		p.removeChild(el);
		el.innerHTML = html;
		p.appendChild(el)
	};

	var updateEditor = function (html) {
		var hadFocus = editorHasFocus();
		var scroll = {top:editorEl.scrollTop};
		offDomReplaceHTML(editorEl, html);
		if (hadFocus) {
			editorEl.focus();
			moveEditorCaret(currentPos.begin, currentPos.end);
		}
		editorEl.scrollTop = scroll.top;
	};

	var safetyTimer, inProgressTimer;
	var refresh = function(forceText){
		if (!forceText && !hasChanged()) return;
		saveToLocalStorage();
		// No refresh if empty regex (TODO:Remove errors)
		if(input.value.length == 0) {
			resultsEl.innerHTML = "";
			updateResultsTitle(0)
			unhighlight(forceText);
		} else {
			var userRe = parseRe(input.value);
			var text = unescape(forceText || editorEl.textContent);
			if (userRe) {
				window.clearTimeout(inProgressTimer);
				window.clearTimeout(safetyTimer);

				terminateCurrentWorker();
				worker = regexWorkerFactory.build(onWorkerSuccess);
				worker.postMessage({
					userRe : userRe,
					text : text
				});

				inProgressTimer = window.setTimeout(displayInProgressIndicator, 100);
				safetyTimer = window.setTimeout(onWorkerTimeout, 3000);
			}
		}
	};
	var currentPos={};
	var onWorkerSuccess = function (event) {
		var data = event.data;
		window.clearTimeout(inProgressTimer);
		window.clearTimeout(safetyTimer);
		resultsEl.innerHTML = data.resultsHTML;
		updateEditor(data.textHTML);
		updateResultsTitle(data.resultsLength);

		// ERROR/PROGRESS -> SUCCESS
		input.classList.remove("in-progress");
		hideMessage();
	};

	var onWorkerTimeout = function () {
		window.clearTimeout(inProgressTimer);
		terminateCurrentWorker();
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

	var encodeCurrentSnippet = function () {
		var text = unescape(editorEl.textContent);
		return JSON.stringify({
			"re" : input.value,
			"text" : text
		});
	};

	var saveToLocalStorage = function () {
		window.localStorage.instantReSnapshot = encodeCurrentSnippet()
	};
	var cachedSnippet;
	var hasChanged = function () {
		var currentSnippet = encodeCurrentSnippet();
		if (currentSnippet != cachedSnippet) {
			cachedSnippet = currentSnippet;
			return true;
		} else {
			return false;
		}
	};

	var SPECIAL = {
		ENTER : 13,
		TAB : 9
	};

	var isSpecialKey = function (evt) {
		for (var i in SPECIAL) {
			if (evt.keyCode == SPECIAL[i]) {
				return true;
			}
		}
		return false;
	};

	var onPreKeydown = function (evt) {
		if (isSpecialKey(evt)) {
			evt.preventDefault();	
			var caret = getCurrentCaretPos();
			var	text = editorEl.textContent;
			if (evt.keyCode == SPECIAL.ENTER) {	
				text = text.substring(0, caret.begin) + "\n" + text.substring(caret.end);
				currentPos = {begin : caret.begin+1, end : caret.begin+1};
			} else if (evt.keyCode == SPECIAL.TAB) {
				text = text.substring(0, caret.begin) + (new Array(5)).join(" ") + text.substring(caret.end);
				currentPos = {begin : caret.begin+4, end : caret.begin+4};
			}
			refresh(text);
		}
	};

	var onPreKeyup = function (evt) {	
		if (!isSpecialKey(evt)) {
			currentPos = getCurrentCaretPos();
			refresh();	
		}
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
	input.addEventListener("keyup", function () {refresh()});
	editorEl.addEventListener("keydown", onPreKeydown);
	editorEl.addEventListener("keyup", onPreKeyup);
	document.getElementsByClassName("head-logo")[0].addEventListener("click", clear);

	if (window.localStorage.instantReSnapshot) {
		eval("var snippet = " + window.localStorage.instantReSnapshot);
		load(snippet.re, snippet.text);
		input.focus();
	}
})();