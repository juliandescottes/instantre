window.regexWorker = function () {
	var MAX_RESULTS = 1000;

	var escape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	};

	var unescape = function (text) {
		if(typeof text != "string") text = "";
		return text.replace(/\&gt;/g, ">").replace(/\&lt;/g, "<").replace(/\&amp;/g, "&");
	};

	var getLineForMatch = function (match, lines) {
		var index = match.index, endIndex = 0;
		for (var i = 0 ; i < lines.length ; i++) {
			endIndex += lines[i].length+1;
			if (index < endIndex) {
				return i;
			}
		}
	};

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

		return "<li title='jump to line "+(line+1)+"'>" + html + " (line:" + (line+1) + ")</li>";
	};

	/*
	 * Tokens used to surround text to highlight
	 */
	var TOKEN_BEGIN = "_INSTANTRE_BEGIN_",
		TOKEN_END = "_INSTANTRE_END_";

	var RE_BEGIN = new RegExp(TOKEN_BEGIN, "g"),
		RE_END = new RegExp(TOKEN_END, "g"),
		JOINT_TOKENS = new RegExp(TOKEN_END+TOKEN_BEGIN, "g");


	var highlightText = function (text, re, tooManyResults) {
		var tokenizedText = text.replace(re, tokenReplacer);
		var cssClass = tooManyResults ? "editor-match-fast" : "editor-match"
		if (tooManyResults) {
			// merge everything ...
			tokenizedText = tokenizedText.replace(JOINT_TOKENS, "");
		}
		return escape(tokenizedText).replace(RE_BEGIN, "<span class='"+cssClass+"'>").replace(RE_END, "</span>");
	};
	/**
	 * string.replace replacer. Will surround non empty matches with tokens 
	 */
	var tokenReplacer = function (match) {
		// filter out empty matches
		if (match.length > 0) {
			return TOKEN_BEGIN+match+TOKEN_END;
		} else {
			return match;
		}
	};

	self.onmessage = function(event) {
		var userRe = event.data.userRe,
			text = event.data.text;

		var match, matchMarkup, line, results = [], safe = 0;
		// compute lines outside of main loop (TODO:Caching ?)
		var lines = text.split("\n");
		while (match = userRe.exec(text)) {
			if(safe++>MAX_RESULTS) break;
			//if (match[0].length == 0) continue;
			line = getLineForMatch(match, lines);
			matchMarkup = createMarkupForMatch(match, line);
			results.push(matchMarkup);
		}
		var resultsHTML = "<ul>" + results.join("") + "</ul>";	
		self.postMessage({
			resultsHTML : resultsHTML,
			textHTML : highlightText(text, userRe, results.length >= MAX_RESULTS),
			resultsLength : results.length
		});
	};
};


