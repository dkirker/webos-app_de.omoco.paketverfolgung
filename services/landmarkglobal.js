function LandmarkGlobal() {
}

LandmarkGlobal.prototype.getAuthor = function() {
	return "Donald Kirker";
}

LandmarkGlobal.prototype.getVersion = function() {
	return "1.0";
}

LandmarkGlobal.prototype.getColor = function() {
	return "#dc002e";
}

LandmarkGlobal.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

LandmarkGlobal.prototype.getTrackingUrl = function() {
	return "https://track.landmarkglobal.com/?trck=" + this.id;
}

LandmarkGlobal.prototype.getDetails = function() {
	var request = new Ajax.Request(this.getTrackingUrl(), {
		method: "post",
		parameters: {"action": "View Complete Tracking History", "options[]": "DISPLAY_FULL_HISTORY"},
		evalJS: "false",
		evalJSON: "true",
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

LandmarkGlobal.prototype.getDetailsRequestSuccess = function(response) {
	var responseText = response.responseText;

Mojo.Log.info("Landmark responseText: " + responseText);

	var addressContainerText = responseText.split("<div class=\"per_address_container\">");
	if (addressContainerText.length > 1) {
		responseText = addressContainerText[1];
	} else {
		Mojo.Log.error("Landmark error no address container " + responseText);
	}

	var currentStatusInfo = responseText.split("<div class=\'current_status_information\'>");
	if (currentStatusInfo.length > 1) {
		currentStatusInfo = currentStatusInfo[1];
	} else {
		Mojo.Log.error("Landmark no current status info" + responseText);
	}

	var status = 0;
	var statusText = currentStatusInfo.split("<b>Current Status: </b>");
	if (statusText.length > 1) {
		statusText = statusText[1].split("</div>")[0].trim();
	} else {
		Mojo.Log.error("Landmark no current status" + responseText);
	}
Mojo.Log.info("Landmark statusText: " + statusText);

	switch (statusText.toLowerCase()) {
		case "shipment data uploaded":
			status = 1;
			break;
		case "processed":
			status = 2;
			break;
		case "scanned at landmark crossdock facility":
		case "crossing border and in transit to carrier hub":
		case "received in destination country":
		// Below are destination courier status codes
		case "arrived shipping partner facility, usps awaiting item": // USPS
		case "departed shipping partner facility, usps awaiting item": // USPS
		case "arrived at usps regional facility": // USPS
		case "accepted at usps regional destination facility": // USPS
		case "arrived at usps regional destination facility": // USPS
		case "departed usps regional facility": // USPS
		case "arrived at usps facility": // USPS
		case "arrived at post office": // USPS
		case "sorting complete": // USPS
			status = 3;
			break;
		case "out for delivery": // USPS
		case "delivery attempt": // USPS
		case "notice left": // USPS
			status = 4;
			break;
		case "delivered": // Generic
		case "delivered, in/at mailbox": // USPS
			status = 5;
			break;
		default:
			if (statusText.toLowerCase().indexOf("delivered") != -1) { // USPS - other than in mailbox
				status = 5;
			}
			break;
	}
Mojo.Log.info("Landmark status: " + status);

/*
	var metadata = {};

	// metadata.delivery = 
	// metadata.serviceclass = 

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}
*/

	var details = [];
	if (status > 0) {
		var detailsTable = currentStatusInfo.split("<table class=\'alternating_colors padded full\'>");

		if (detailsTable.length > 1) {
			var detailsText = detailsTable[1].split("<tr");
Mojo.Log.info("Landmark detailsText length: " + detailsText.length);
		
			for (var i = 2; i < detailsText.length; i++) {
				var detailsItems = detailsText[i].split("<td");
				if (detailsItems.length == 1) {
					Mojo.Log.error("Landmark invalid details row " + detailsText[i]);
					break;
				}
				var tmpDate = detailsItems[2].split("</td>")[0].split(">")[1];
				var tmpLoc = detailsItems[3].split("</td>")[0].split(">")[1];
				var tmpNotes = detailsItems[1].split("</td>")[0].split(">")[1];
Mojo.Log.info("Landmark tmpDate: " + tmpDate + " tmpLoc: " + tmpLoc + " tmpNotes: " + tmpNotes);

				details.push({date: tmpDate, location: tmpLoc, notes: tmpNotes});
			}
		} else {
			Mojo.Log.error("Landmark no details table " + currentStatusInfo);
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

LandmarkGlobal.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("Landmark Status: ", response.statusText, " Response: ", response.responseText,
				  " Headers: ", Object.toJSON(response.headerJSON),
				  " Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error."));
};

registerService("Landmark Global", new LandmarkGlobal());
