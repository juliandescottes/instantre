(function () {
	var MAX_RESULTS = 1000;

	var input = document.getElementById("regexp-input"),
		textEl = document.getElementById("text-editor"),
		resultsEl = document.getElementById("matches-list"),
		previewEl = document.getElementById("results-preview"),
		resultsTitleEl = document.getElementById("matches-header");

	var editor = null, store = null;

	editor = ace.edit("text-editor");
	editor.setTheme("ace/theme/idle_fingers");
        editor.getSession().setMode("ace/mode/text");
	editor.setFontSize("16px");sdfsdsdf
	//editor.renderer.setShowGutter(false);

	var key = "apiKey=eHom4izItOoREUUPRPKfBNwzQdDlO-62";s
	store = new MongoStore("instant-re", "snippets", key);
   
	var snippet = {
		re : "",
		text : ""
	};

	var load = function (re, text) {
		input.value = re;
		editor.setValue(text);
		refresh();
		editor.moveCursorTo(0,0);
	};

	var escape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	};

	var unescape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&gt;/g, ">").replace(/\&lt;/g, "<").replace(/\&amp;/g, "&");
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
			input.classList.remove("input-error");
			previewEl.classList.remove("out-of-date");
			return re;
		} catch (e) {
			input.classList.add("input-error");
			previewEl.classList.add("out-of-date");    
			console.error("invalid regular expression : " + reString);
		}
	};

	var getLineForMatch = function (match, lines) {
		var index = match.index, endIndex = 0;
		for (var i = 0 ; i < lines.length ; i++) {
			endIndex += lines[i].length+1;
			if (index < endIndex) {
				return i;
			}
		}
	}

	var createMarkupForMatch = function (match, line) {
		var html = "";
		var matchedString = escape(match[0]);
		if(match.length > 1) {
			var groups = match.splice(1);
			for (var i = 0 ; i < groups.length ; i++) {
				html += "<span class='matched-group'>" + escape(groups[i]) + "</span>";
			}
			html += "found in " + "<span class='matched-string'>" + matchedString + "</span>"; 
		} else {
			html += "<span class='matched-string'>" + matchedString + "</span>";
		}

		return "<li title='jump to line "+(line+1)+"' onclick='scrollToLine("+(line+1)+")'>" + html + " (line:" + (line+1) + ")</li>";
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

	var refresh = function(){
		// No refresh if empty regex (TODO:Remove errors)
		if(input.value.length = 0) return;
		
		var regexAsString = input.value;
		var userRe = parseRe(input.value);
		var text = unescape(editor.getValue());
		
		saveToLocalStorage(regexAsString, text);

		if (userRe) {
			var modifiedText = text.replace(userRe,"_INSTANTRE_BEGIN_$&_INSTANTRE_END_");
			//console.log(modifiedText);
			textEl.innerHTML = escape(modifiedText).replace(/_INSTANTRE_BEGIN_/g, "<span class='editor-match'>").replace(/_INSTANTRE_END_/g, "</span>");
			var match, matchMarkup, line, results = [], safe = 0;
			// compute lines outside of main loop (TODO:Caching ?)
			var lines = text.split("\n");
			while (match = userRe.exec(text)) {
				if(safe++>MAX_RESULTS) break;
				line = getLineForMatch(match, lines);
				matchMarkup = createMarkupForMatch(match, line);
				results.push(matchMarkup);
			}
			resultsEl.innerHTML = "<ul>" + results.join("") + "</ul>";	
			updateResultsTitle(results.length);
		}
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

	var saveToLocalStorage = function (re, text) {
		window.localStorage.instantReSnapshot = JSON.stringify({
			"re" : re,
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
			
			refresh();
			moveCaret(textEl, caretPos.begin+1);

			evt.preventDefault();
		} else if (evt.keyCode == KEYCODE.TAB) {
			textEl.textContent = text.substring(0, caretPos.begin) + (new Array(5)).join(" ") + text.substring(caretPos.end);
			refresh();
			moveCaret(textEl, caretPos.begin+4);

			evt.preventDefault();
		}
		
	};

	var onPreKeyup = function (evt) {	
		if ([KEYCODE.ENTER, KEYCODE.TAB].indexOf(evt.keyCode) != -1) return;
		var caretPos = getCurrentCaretPos();
		refresh();
		moveCaret(textEl, caretPos.begin, caretPos.end);
	};
	// if using keydown, I don't have the value directly in the input field. 
	// Would need to either : 
	// 1 : timeout
	// 2 : store the RE somewhere else
	input.addEventListener("keyup", refresh);
	textEl.addEventListener("keydown", onPreKeydown);

	textEl.addEventListener("keyup", onPreKeyup);
	window.textEl =textEl;

	if (window.localStorage.instantReSnapshot) {
		eval("var snippet = " + window.localStorage.instantReSnapshot);
		load(snippet.re, snippet.text);
		input.focus();
	}
})();