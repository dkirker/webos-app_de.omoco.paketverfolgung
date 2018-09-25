function UPS() {
}

UPS.prototype.getAuthor = function() {
	return "Sebastian Hammerl, Donald Kirker";
}

UPS.prototype.getVersion = function() {
	return "1.4.1";
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

UPS.prototype.lookupToken = function(input) {
	var dictionary = {
			"cms.stapp.eod": $L("End of Day"),
			"cms.stapp.mon": $L("Monday"),
			"cms.stapp.tue": $L("Tuesday"),
			"cms.stapp.wed": $L("Wednesday"),
			"cms.stapp.thu": $L("Thursday"),
			"cms.stapp.fri": $L("Friday"),
			"cms.stapp.sat": $L("Saturday"),
			"cms.stapp.sun": $L("Sunday"),
			"cms.stapp.delivery": $L("Delivered"),
		};
	var result = input;

	if (dictionary[input]) {
		result = dictionary[input];
	}

	return result;
};

UPS.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;

	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	// statusText:
	//   "Successful" - ok (statusCode: 200)
	//   "FAIL" - error (statusCode: 299)
	if (!json || json.statusText != "Successful" ||
		!json.trackDetails || !json.trackDetails[0]) {
			this.callbackStatus(-1);
			return;
	}
	var errorCode = json.trackDetails[0].errorCode;
	var packageStatus = json.trackDetails[0].packageStatus;
	var status = 0;

	if (!packageStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		packageStatus = packageStatus.toLowerCase();
	}

	Mojo.Log.info("UPS errorCode: ", errorCode, " packageStatus: ", packageStatus);
Mojo.Log.info("UPS JSON: ", response.responseText);
	// TODO: I am only certain on statuses from the scan history
	if (errorCode != null) {
		status = -1;
	} else if (packageStatus.indexOf("initiated") != -1 || packageStatus.indexOf("label created") != -1 ||
			   packageStatus.indexOf("order processed") != -1 || packageStatus.indexOf("shipment ready for ups") != -1) {
		status = 1;
	} else if (packageStatus.indexOf("pickup") != -1 || packageStatus.indexOf("picked") != -1) {
		status = 2;
	} else if (packageStatus.indexOf("destination scan") != -1 || packageStatus.indexOf("arrival scan") != -1 ||
			   packageStatus.indexOf("departure scan") != -1 || packageStatus.indexOf("origin scan") != -1 ||
			   packageStatus.indexOf("in transit") != -1) {
		status = 3;
	} else if (packageStatus.indexOf("delivery") != -1 || packageStatus.indexOf("exception") != -1) { // Exceptions can happen anywhere, and this shouldn't be indicitive of "out for delivery"
		status = 4;
	} else if (packageStatus.indexOf("delivered") != -1) {
		status = 5;
	}

	var metadata = {};
	if (status == 5) {
		metadata.delivery = json.trackDetails[0].deliveredDate + " " + json.trackDetails[0].deliveredTime + ", at " + json.trackDetails[0].leftAt;
		if (json.trackDetails[0].receivedBy != "") {
			metadata.delivery += " (Signed by: " + json.trackDetails[0].receivedBy + ")";
		}
	} else if (json.trackDetails[0].scheduledDeliveryDate != "" && json.trackDetails[0].scheduledDeliveryTime != "") {
		metadata.delivery = json.trackDetails[0].scheduledDeliveryDate + " " + this.lookupToken(json.trackDetails[0].scheduledDeliveryTime);
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
			if (detailsVar[i].activityScan) {
				var tmpDate = detailsVar[i].date + " " + detailsVar[i].time; // + " " + detailsVar[i].gmtOffset;
				Mojo.Log.info("UPS date: ", tmpDate, " location: ", detailsVar[i].location, " notes: ", detailsVar[i].activityScan);
				details.push({date: tmpDate, location: detailsVar[i].location, notes: detailsVar[i].activityScan});
			} else {
				Mojo.Log.info("UPS passing blank activity: " + JSON.stringify(detailsVar[i]));
			}
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
