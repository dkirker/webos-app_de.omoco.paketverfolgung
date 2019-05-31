function FedEx() {
}

FedEx.prototype.getAuthor = function() {
	return "Donald Kirker";
}

FedEx.prototype.getVersion = function() {
	return "1.2";
}

FedEx.prototype.getColor = function() {
	return "#a472bd";
}

FedEx.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

FedEx.prototype.getTrackingUrl = function() {
	if(LANG == "de")
		return "http://www.fedex.com/Tracking?action=track&language=german&cntry_code=de&mps=y&ascend_header=1&stop_mobi=yes&tracknumbers=" + this.id;
	return "http://www.fedex.com/Tracking?action=track&language=english&cntry_code=en&mps=y&ascend_header=1&stop_mobi=yes&tracknumbers=" + this.id;
}

FedEx.prototype.getDetails = function() {
	var locale = "en_US";
	var data = {
		"TrackPackagesRequest": {
			"appType": "wtrk",
			"uniqueKey": "",
			"processingParameters": {
				"anonymousTransaction": true,
				"clientId": "WTRK",
				"returnDetailedErrors": true,
				"returnLocalizedDateTime": true
			},
			"trackingInfoList": [{
				"trackNumberInfo": {
					"trackingNumber": this.id,
					"trackingQualifier": "",
					"trackingCarrier": ""
				}
			}]
		}
	};

	/*
	if (LANG == "de")
		locale = "de_DE";
	*/

	var dataStringified = Object.toJSON(data);
	Mojo.Log.info("FedEx Data: ", dataStringified);

	var request = new Ajax.Request("https://www.fedex.com/trackingCal/track", {
		method: 'post',
		parameters: {"data": dataStringified, "action": "trackpackages", "locale": locale, "format": "json", "version": "99"},
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

FedEx.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;
	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || !json.TrackPackagesResponse ||
		!json.TrackPackagesResponse.packageList || !json.TrackPackagesResponse.packageList[0]) {
			this.callbackStatus(-1);
			return;
	}
	var errorCode = json.TrackPackagesResponse.packageList[0].errorList[0].code;
	var keyStatus = json.TrackPackagesResponse.packageList[0].keyStatus;
	var status = 0;

	if (!keyStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		keyStatus = keyStatus.toLowerCase();
	}

	Mojo.Log.info("FedEx errorCode: ", errorCode, "keyStatus: ", keyStatus);
Mojo.Log.info("FedEx JSON: ", response.responseText);
	// TODO: I am only certain on "errorCode" and "keyStatus" == "In transit"
	if (errorCode != 0) {
		status = -1;
	} else if (keyStatus.indexOf("initiated") != -1 || keyStatus.indexOf("label created") != -1) {
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
	if (json.TrackPackagesResponse.packageList[0].displayEstDeliveryDateTime &&
		json.TrackPackagesResponse.packageList[0].displayEstDeliveryDateTime != "") {
		metadata.delivery = json.TrackPackagesResponse.packageList[0].displayEstDeliveryDateTime;
	}
	if (json.TrackPackagesResponse.packageList[0].trackingCarrierDesc &&
		json.TrackPackagesResponse.packageList[0].trackingCarrierDesc != "") {
		metadata.serviceclass = json.TrackPackagesResponse.packageList[0].trackingCarrierDesc;
	}

	var serviceDetails = [];
	if (json.TrackPackagesResponse.packageList[0].serviceDesc &&
		json.TrackPackagesResponse.packageList[0].serviceDesc != "") {
		serviceDetails.push(json.TrackPackagesResponse.packageList[0].serviceDesc);
	}
	if (json.TrackPackagesResponse.packageList[0].packaging &&
		json.TrackPackagesResponse.packageList[0].packaging != "") {
		serviceDetails.push(json.TrackPackagesResponse.packageList[0].packaging);
	}
	if (serviceDetails.length > 0) {
		var serviceStr = "";

		for (var i = 0; i < serviceDetails.length; i++) {
			if (i > 0)
				serviceStr += ", ";
			serviceStr += serviceDetails[i];
		}
		metadata.serviceclass += "<br/>(" + serviceStr + ")";
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	var details = [];
	if (status > 0) {
		var detailsVar = json.TrackPackagesResponse.packageList[0].scanEventList;
		for (var i = 0; i < detailsVar.length; i++) {
			var tmpDate = detailsVar[i].date + " " + detailsVar[i].time + " " + detailsVar[i].gmtOffset;
			var tmpLoc = detailsVar[i].scanLocation;
			var tmpNotes = detailsVar[i].status;

			if (detailsVar[i].scanDetails && detailsVar[i].scanDetails != "") {
				tmpNotes += "<br/><br/>" + detailsVar[i].scanDetails;
			}

			Mojo.Log.info("FedEx date: ", tmpDate, " location: ", tmpLoc, " notes: ", tmpNotes);
			details.push({date: tmpDate, location: tmpLoc, notes: tmpNotes});
			if (status < 4 && tmpNotes.toLowerCase().indexOf("delivery") != -1) {
				status = 4; // Hack for "Out for delivery"
			}
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

FedEx.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("FedEx Status: ", response.statusText, " Response: ", response.responseText, " Headers: ", Object.toJSON(response.headerJSON), "Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError("Konnte Seite nicht laden.");
};

registerService("FedEx", new FedEx());
