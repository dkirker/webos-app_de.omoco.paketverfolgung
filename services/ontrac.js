function OnTrac() {
}

OnTrac.prototype.getAuthor = function() {
	return "Donald Kirker";
}

OnTrac.prototype.getVersion = function() {
	return "2.0";
}

OnTrac.prototype.getColor = function() {
	return "#ffd204";
}

OnTrac.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

OnTrac.prototype.getTrackingUrl = function() {
	return "https://www.ontrac.com/trackingresults.asp?tracking_number=" + this.id; // + "&run=" + runId + "&runlocation=0"
}

OnTrac.prototype.getDetails = function() {
	var request = new Ajax.Request("https://www.ontrac.com/services/api/TrackingSummaryByTrackingNumbers/V1/?tracking=" + this.id, {
		method: 'get',
		requestHeaders: {
				"Accept": "application/json, text/javascript, */*; q=0.01"
			},
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestPart1Success.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

OnTrac.prototype.getDetailsRequestPart1Success = function(response) {
	var json = response.responseJSON;
	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || json.length < 1 || !json[0] || json[0].PackageFound != 1) {
		this.callbackStatus(-1);
		this.getDetailsRequestFailure(response);
		return;
	}

	var runId = json[0].Run;
Mojo.Log.info("OnTrac have runId " + runId + " for " + this.id);

	var request = new Ajax.Request("https://www.ontrac.com/services/api/TrackingDetails/V1/" + this.id + "/" + runId + "/0", {
		method: 'get',
		requestHeaders: {
				"Accept": "application/json, text/javascript, */*; q=0.01",
				"Referer": "https://www.ontrac.com/trackingdetails.asp?tracking=" + this.id + "&run=" + runId + "&runlocation=0"
			},
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

OnTrac.prototype._normalizeText = function(input) {
	var wsIdx = -1;
	var output = [];

	if (input.length == 0) {
		return input;
	}

	for (var i = 0; i < input.length; i++) {
		var idxChar = input.charAt(i);

		if (/\s/.test(idxChar))
			wsIdx = i;

		if ((i - 1) == wsIdx && idxChar == idxChar.toUpperCase()) {
			output.push(idxChar);
		} else {
			output.push(idxChar.toLowerCase());
		}
	}

	return output.join("");
};

OnTrac.prototype.getDetailsRequestSuccess = function(response) {
//Mojo.Log.info("OnTrac getDetailsRequestSuccess ", Object.toJSON(response));
Mojo.Log.info("OnTrac getDetailsRequestSuccess");
	var json = response.responseJSON;
	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || !json.RunInfo || json.RunInfo.PackageFound != 1) {
		this.callbackStatus(-1);
		return;
	}
//Mojo.Log.info("OnTrac json ", Object.toJSON(json));
	var keyStatus = json.RunInfo.StatuscodeDisplayText;
	var status = 0; // json.RunInfo.Status ??

	/*
	 * .Status		.StatuscodeDisplayText
	 * ---------------------------------------------
	 *	1			Pending
	 *
	 */

	if (!keyStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		keyStatus = keyStatus.toLowerCase();
	}

	Mojo.Log.info("OnTrac .Status: ", json.RunInfo.Status, "keyStatus: ", keyStatus);
Mojo.Log.info("OnTrac JSON: ", response.responseText);
	if (keyStatus.indexOf("pending") != -1 || keyStatus.indexOf("initiated") != -1 || keyStatus.indexOf("label created") != -1) {
		status = 1;
	} else if (keyStatus.indexOf("picked") != -1) {
		status = 2;
	} else if (keyStatus.indexOf("on schedule") != -1 || keyStatus.indexOf("in transit") != -1) {
		status = 3;
	} else if (keyStatus.indexOf("delivery") != -1 || keyStatus.indexOf("exception") != -1) { // Exceptions can happen anywhere, and this shouldn't be indicitive of "out for delivery"
		status = 4;
	} else if (keyStatus.indexOf("delivered") != -1) {
		status = 5;
	}

	var metadata = {};
	if (json.RunInfo.ExpectedDeliveryDateTime && json.RunInfo.ExpectedDeliveryDateTime != "") {
		metadata.delivery = json.RunInfo.ExpectedDeliveryDateTime;
	}
	if (status == 5 && json.RunInfo.POD && json.RunInfo.POD != "") {
		if (!metadata.delivery)
			metadata.delivery = "";
		metadata.delivery += "<br/><br/>" + json.RunInfo.StatuscodeDisplayText + ", " + this._normalizeText(json.RunInfo.POD);
	}
	if (json.RunInfo.Service && json.RunInfo.Service != "") {
		metadata.serviceclass = this._normalizeText(json.RunInfo.Service);

		var extraClasses = [];

		if (json.RunInfo.SignatureRequired && json.RunInfo.SignatureRequired != "No") {
			extraClasses.push($L("Signature Required"));
		}
		if (json.RunInfo.SaturdayDelivery && json.RunInfo.SaturdayDelivery != "No") {
			extraClasses.push($L("Saturday Delivery"));
		}
		if (json.RunInfo.Cod && json.RunInfo.Cod != "No") {
			extraClasses.push($L("Cash On Delivery"));
		}

		extraClasses.each(function(item) {
				metadata.serviceclass += ", " + item;
			});
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	var details = [];
	if (status > 0) { // && json.OnTracEvents && json.OnTracEvents.length > 0) {
		var statusItr = function(detailsVar) {
				//var detailsVar = json.OnTracEvents;
				for (var i = 0; i < detailsVar.length; i++) {
					var tmpDate = detailsVar[i].EventDate + " " + detailsVar[i].EventTime;
					var tmpLoc = detailsVar[i].EventLocation;
					var tmpNotes = detailsVar[i].StatuscodeDescriptionText;

					if (status == 5 && tmpNotes.toLowerCase().indexOf("delivered") != -1 &&
						json.RunInfo.POD && json.RunInfo.POD != "") {
						tmpNotes += " " + this._normalizeText(json.RunInfo.POD);
					}

					if (detailsVar[i].DoorTag && detailsVar[i].DoorTag != "") {
						tmpNotes += " Door tag: " + detailsVar[i].DoorTag;
					}

					Mojo.Log.info("OnTrac date: ", tmpDate, " location: ", tmpLoc, " notes: ", tmpNotes);
					details.push({date: tmpDate, location: tmpLoc, notes: tmpNotes});
					if (status < 4 && tmpNotes.toLowerCase().indexOf("delivery") != -1) {
						status = 4; // Hack for "Out for delivery"
					}
				}
			}.bind(this);
		if (json.OnTracEvents && json.OnTracEvents.length > 0) {
			statusItr(json.OnTracEvents);
		}
		if (json.USPSEvents && json.USPSEvents.length > 0) {
			statusItr(json.USPSEvents);
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

OnTrac.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("OnTrac getDetailsRequestFailure");
	Mojo.Log.info("OnTrac Status: ", response.statusText, " Response: ", response.responseText, " Headers: ", Object.toJSON(response.headerJSON), "Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError("There was an error");
};

registerService("OnTrac", new OnTrac());
