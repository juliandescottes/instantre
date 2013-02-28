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

self.onmessage = function(event) {
	var userRe = event.data.userRe;
	var text = event.data.text;
	var modifiedText = text.replace(userRe,"_INSTANTRE_BEGIN_$&_INSTANTRE_END_");
	var textHTML = escape(modifiedText).replace(/_INSTANTRE_BEGIN_/g, "<span class='editor-match'>").replace(/_INSTANTRE_END_/g, "</span>");
	var match, matchMarkup, line, results = [], safe = 0;
	// compute lines outside of main loop (TODO:Caching ?)
	var lines = text.split("\n");
	while (match = userRe.exec(text)) {
		if(safe++>MAX_RESULTS) break;
		line = getLineForMatch(match, lines);
		matchMarkup = createMarkupForMatch(match, line);
		results.push(matchMarkup);
	}
	var resultsHTML = "<ul>" + results.join("") + "</ul>";	
	self.postMessage({
		resultsHTML : resultsHTML,
		textHTML : textHTML,
		resultsLength : results.length
	});
};

