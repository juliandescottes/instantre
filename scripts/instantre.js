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
	editor.setFontSize("16px");
	//editor.renderer.setShowGutter(false);

	var key = "apiKey=eHom4izItOoREUUPRPKfBNwzQdDlO-62";
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

	window.scrollToLine = function (line) {
		editor.setAnimatedScroll(true);
		editor.gotoLine(line, 0, true); //test
	}

	var refresh = function(){
		// No refresh if empty regex (TODO:Remove errors)
		if(input.value.length = 0) return;
		
		var regexAsString = input.value;
		var userRe = parseRe(input.value);
		var text = unescape(editor.getValue());
		
		saveToLocalStorage(regexAsString, text);

		if (userRe) {
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
	}

	var saveToLocalStorage = function (re, text) {
		window.localStorage.instantReSnapshot = JSON.stringify({
			"re" : re,
			"text" : text
		});
	}

	if (window.localStorage.instantReSnapshot) {
		eval("var snippet = " + window.localStorage.instantReSnapshot);
		load(snippet.re, snippet.text);
		input.focus();
	}

	window.addEventListener("keyup", refresh);
})();