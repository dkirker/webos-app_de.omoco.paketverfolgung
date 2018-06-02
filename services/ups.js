function UPS() {
}

UPS.prototype.getAuthor = function() {
	return "Sebastian Hammerl, Donald Kirker";
}

UPS.prototype.getVersion = function() {
	return "1.4.0";
}

UPS.prototype.getColor = function() {
	return "#8b7271";
}

UPS.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

UPS.prototype.getTrackingUrl = function() {
	var locale = "en_US";
	if(LANG == "de")
		locale = "de_DE";
	return "http://wwwapps.ups.com/WebTracking/track?HTMLVersion=5.0&loc=" + locale + "&trackNums=" + this.id + "&track.y=10&Requester=TRK_MOD&showMultipiece=N&detailNumber=undefined&WBPM_lid=homepage%2Fct1.html_pnl_trk";
}

UPS.prototype.getDetails = function() {
	var locale = "en_US";
	var data = {"Locale": locale, "TrackingNumber": [this.id]};

	/*
	if (LANG == "de")
		locale = "de_DE";
	*/

	var dataStringified = Object.toJSON(data);

	var request = new Ajax.Request("https://www.ups.com/track/api/Track/GetStatus?loc=" + locale, {
		method: 'post',
		contentType: "application/json",
		postBody: dataStringified,
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

UPS.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;

	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || json.statusText != "Successful" ||
		!json.trackDetails || !json.trackDetails[0]) {
			this.callbackStatus(-1);
			return;
	}
	var errorCode = json.trackDetails[0].errorCode;
	var keyStatus = json.trackDetails[0].packageStatus;
	var status = 0;

	if (!keyStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		keyStatus = keyStatus.toLowerCase();
	}

	Mojo.Log.info("UPS errorCode: ", errorCode, "keyStatus: ", keyStatus);
Mojo.Log.info("UPS JSON: ", response.responseText);
	// TODO: I am only certain on statuses from the scan history
	if (errorCode != null) {
		status = -1;
	} else if (keyStatus.indexOf("initiated") != -1 || keyStatus.indexOf("label created") != -1 ||
			   keyStatus.indexOf("order processed") != -1) {
		status = 1;
	} else if (keyStatus.indexOf("pickup") != -1 || keyStatus.indexOf("picked") != -1) {
		status = 2;
	} else if (keyStatus.indexOf("destination scan") != -1 || keyStatus.indexOf("arrival scan") != -1 ||
			   keyStatus.indexOf("departure scan") != -1 || keyStatus.indexOf("origin scan") != -1) {
		status = 3;
	} else if (keyStatus.indexOf("delivery") != -1 || keyStatus.indexOf("exception") != -1) { // Exceptions can happen anywhere, and this shouldn't be indicitive of "out for delivery"
		status = 4;
	} else if (keyStatus.indexOf("delivered") != -1) {
		status = 5;
	}

	var metadata = {};
	if (status == 5) {
		metadata.delivery = json.trackDetails[0].deliveredDate + " " + json.trackDetails[0].deliveredTime + ", at " + json.trackDetails[0].leftAt;
	} else if (json.trackDetails[0].scheduledDeliveryDate != "" && json.trackDetails[0].scheduledDeliveryTime != "") {
		metadata.delivery = json.trackDetails[0].scheduledDeliveryDate + " " + json.trackDetails[0].scheduledDeliveryTime;
	}
Mojo.Log.info("UPS delivery by: " +  metadata.delivery);
	if (json.trackDetails[0].additionalInformation && json.trackDetails[0].additionalInformation.serviceInformation &&
		json.trackDetails[0].additionalInformation.serviceInformation.serviceName != "") {
		metadata.serviceclass = json.trackDetails[0].additionalInformation.serviceInformation.serviceName;
	}
Mojo.Log.info("UPS serviceClass: " + metadata.serviceclass);

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	var details = [];
	if (status > 0) {
		var detailsVar = json.trackDetails[0].shipmentProgressActivities;
Mojo.Log.info("UPS scans: " + detailsVar.length);
		for (var i = 0; i < detailsVar.length; i++) {
			var tmpDate = detailsVar[i].date + " " + detailsVar[i].time; // + " " + detailsVar[i].gmtOffset;
			Mojo.Log.info("UPS date: ", tmpDate, " location: ", detailsVar[i].location, " notes: ", detailsVar[i].activityScan);
			details.push({date: tmpDate, location: detailsVar[i].location, notes: detailsVar[i].activityScan});
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

UPS.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("UPS Status: ", response.statusText, " Response: ", response.responseText, " Headers: ", Object.toJSON(response.headerJSON), "Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error")/*"Konnte Seite nicht laden."*/);
};

registerService("UPS", new UPS());
