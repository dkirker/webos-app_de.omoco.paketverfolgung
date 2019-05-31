function SpeedPAK() {
}

SpeedPAK.prototype.getAuthor = function() {
	return "Donald Kirker";
}

SpeedPAK.prototype.getVersion = function() {
	return "1.0.0";
}

SpeedPAK.prototype.getColor = function() {
	return "#EE7532";
}

SpeedPAK.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

SpeedPAK.prototype.getTrackingUrl = function() {
	var locale = "en";

	return "https://www.orangeconnex.com/tracking?language=" + locale + "&trackingnumber=" + this.id;
}

SpeedPAK.prototype.getDetails = function() {
	var data = {"trackingNumbers": [this.id]};

	var dataStringified = Object.toJSON(data);

	var request = new Ajax.Request("https://azure-cn.orangeconnex.com/oc/capricorn-website/website/v1/tracking/traces", {
		method: 'post',
		contentType: "application/json",
		postBody: dataStringified,
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

SpeedPAK.prototype._getScanStatus = function(scanStr){
	var statusMap = {
		"import customs clearance completed": 3,
		"import custom clearance completed": 3,
		"departed warehouse": 3,
		"arrived at wns warehouse": 3,
		"destination port arrival": 3,
		"port departure": 3,
		"first port departure": 3,
		"export custom declaration completed": 3,
		"handover manifest send": 3,
		"waiting for international transport": 3,
		"rdc departure": 3,
		"ash departure": 3,
		"consolidation center arrived": 3,
		"consolidation center departure": 3,
		"pickup task completed": 2,
		"order received": 1,
		"post receiving scan (a-scan)": 2,

		"initiated": 1,
		"label created": 1,
		"order processed": 1,
		"shipment data received": 1,
		"pickup": 2,
		"picked": 2,
		"package received": 2,
		"destination scan": 3,
		"arrival scan": 3,
		"departure scan": 3,
		"origin scan": 3,
		"in transit": 3,
		"consolidation facility arrived": 3,
		"consolidation facility departed": 3,
		"regional distribution center arrived": 3,
		"regional distribution center departed": 3,
		"flight landed in destination country": 3,
		"arrived at usps facility": 3,
		"arrived": 3,
		"departed": 3,
		"delivery": 4,
		"exception": 4,
		"delivered": 5
	};
	var lowerScanStr = scanStr.toLowerCase();
	var status = 0;

	// Manual overrides here

	// Check for full strings
	if (statusMap.hasOwnProperty(lowerScanStr)) {
		status = statusMap[lowerScanStr];
	} else {
		var parts = lowerScanStr.split(" ");

		// Complete string didn't exist, so break into parts and check
		for (var i = 0; i < parts.length; i++) {
			if (statusMap.hasOwnProperty(parts[i])) {
				Mojo.Log.error("Unknown status \"", scanStr, "\" matched with part \"", parts[i], "\"");
				status = statusMap[parts[i]];
				break;
			}
		}
	}

	return status;
};


SpeedPAK.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;

	if (!json) {
		if (response.responseText) {
			json = Mojo.parseJSON(response.responseText);
		} else {
			this.callbackStatus(-1);
			return;
		}
	}

	var results = json.result;
	if (!json.success || results.notExistsTrackingNumbers.length > 0 ||
		!results.waybills || !results.waybills[0]) {
			this.callbackStatus(-1);
			return;
	}

	var packageStatus = results.waybills[0].lastStatus;
	var status = 0;

	if (!packageStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		packageStatus = packageStatus.toLowerCase();
	}

	Mojo.Log.info("SpeedPAK  packageStatus: ", packageStatus);
//Mojo.Log.info("SpeedPAK JSON: ", response.responseText);

	status = this._getScanStatus(packageStatus);
/*
	// TODO: I am only certain on statuses from the scan history
	if (packageStatus.indexOf("initiated") != -1 || packageStatus.indexOf("label created") != -1 ||
		packageStatus.indexOf("order processed") != -1 ||
		packageStatus.indexOf("shipment data received") != -1) {
		status = 1;
	} else if (packageStatus.indexOf("pickup") != -1 || packageStatus.indexOf("picked") != -1 ||
			   packageStatus.indexOf("package received") != -1) {
		status = 2;
	} else if (packageStatus.indexOf("destination scan") != -1 || packageStatus.indexOf("arrival scan") != -1 ||
			   packageStatus.indexOf("departure scan") != -1 || packageStatus.indexOf("origin scan") != -1 ||
			   packageStatus.indexOf("in transit") != -1 ||
			   packageStatus.indexOf("consolidation facility arrived") != -1 || packageStatus.indexOf("consolidation facility departed") != -1 ||
			   packageStatus.indexOf("regional distribution center arrived") != -1 || packageStatus.indexOf("regional distribution center departed") != -1) {
		status = 3;
	} else if (packageStatus.indexOf("delivery") != -1 || packageStatus.indexOf("exception") != -1) { // Exceptions can happen anywhere, and this shouldn't be indicitive of "out for delivery"
		status = 4;
	} else if (packageStatus.indexOf("delivered") != -1) {
		status = 5;
	}
*/

	Mojo.Log.info("SpeedPAK  status: ", status);
/*
	var metadata = {};
	if (status == 5) {
		metadata.delivery = json.trackDetails[0].deliveredDate + " " + json.trackDetails[0].deliveredTime + ", at " + json.trackDetails[0].leftAt;
		if (json.trackDetails[0].receivedBy != "") {
			metadata.delivery += " (Signed by: " + json.trackDetails[0].receivedBy + ")";
		}
	} else if (json.trackDetails[0].scheduledDeliveryDate != "" && json.trackDetails[0].scheduledDeliveryTime != "") {
		metadata.delivery = json.trackDetails[0].scheduledDeliveryDate + " " + this.lookupToken(json.trackDetails[0].scheduledDeliveryTime);
	}
Mojo.Log.info("SpeedPAK delivery by: " +  metadata.delivery);
	if (json.trackDetails[0].additionalInformation && json.trackDetails[0].additionalInformation.serviceInformation &&
		json.trackDetails[0].additionalInformation.serviceInformation.serviceName != "") {
		metadata.serviceclass = json.trackDetails[0].additionalInformation.serviceInformation.serviceName;
	}
Mojo.Log.info("SpeedPAK serviceClass: " + metadata.serviceclass);

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}
*/

	var details = [];
	if (status > 0) {
		var detailsVar = results.waybills[0].traces;
Mojo.Log.info("SpeedPAK scans: " + detailsVar.length);
		for (var i = 0; i < detailsVar.length; i++) {
			var tmpDate = Mojo.Format.formatDate(new Date(detailsVar[i].oprTimestamp), {date: "short", time: "short"});
			var tmpLocation = (detailsVar[i].oprCity) ? detailsVar[i].oprCity + ", " + detailsVar[i].oprCountry : detailsVar[i].oprCountry;

			if (detailsVar[i].oprZipCode) {
				tmpLocation += " " + detailsVar[i].oprZipCode;
			}

			Mojo.Log.info("SpeedPAK date: ", tmpDate, " location: ", tmpLocation, " notes: ", detailsVar[i].eventDesc);
			details.push({date: tmpDate, location: tmpLocation, notes: detailsVar[i].eventDesc});

			if (status < 4 && detailsVar[i].eventDesc.toLowerCase().indexOf("package out for post office delivery") != -1) {
				status = 4;
			}
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

SpeedPAK.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("SpeedPAK Status: ", response.statusText, " Response: ", response.responseText, " Headers: ", Object.toJSON(response.headerJSON), "Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error")/*"Konnte Seite nicht laden."*/);
};

registerService("SpeedPAK", new SpeedPAK());
