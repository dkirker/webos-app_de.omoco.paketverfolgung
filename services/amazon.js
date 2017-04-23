function Amazon() {
}

Amazon.prototype.getAuthor = function() {
	return "Donald Kirker";
}

Amazon.prototype.getVersion = function() {
	return "1.0";
}

Amazon.prototype.getColor = function() {
	return "#f08804";
}

Amazon.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

Amazon.prototype.getTrackingUrl = function() {
	var trackingUrl = "";

	// Make sure string starts with https:// otherwise sanitize
	if (this.id.indexOf("https://") != 0) {
		trackingUrl = "https://" + this.id;
	} else {
		trackingUrl = "" + this.id;
	}

	return trackingUrl;
};

Amazon.prototype.getDetails = function() {
	var request = new Ajax.Request(this.getTrackingUrl(), {
		method: 'get',
		evalJS: 'false',
		evalJSON: 'false',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

Amazon.prototype.getDetailsRequestSuccess = function(response) {
//Mojo.Log.info("tracking # " + this.id);
	var responseText = response.responseText;
//Mojo.Log.info("responseText: " +responseText);
//	var statusText = "";
//Mojo.Log.info("statusFrag: " + statusText);


	var status = 0;
	if (responseText.indexOf("<span class=\"delivery-status\"") != -1) {
		status = 5;
	} else if (responseText.indexOf("<span class=\"shipped-status\"") != -1) {
        status = 3;
    } else if (responseText.indexOf("<span class=\"ordered-status\"") != -1) {
		status = 1;
	} else {
		status = 1; //0;
	}
//Mojo.Log.info("status: " +status);
	// Defer this
	//this.callbackStatus(status);

	var metadata = {};
	var deliveryStr = "";
	var deliveryFrag = responseText.split("<span class=\"delivery-date\">")
	if (deliveryFrag.length > 1) {
		deliveryStr = deliveryFrag[1].split("</span>")[0].trim();
	} else { // We must have mobile...
		deliveryStr = responseText.split("<div class=\"a-column a-span12 shipment-status-content\">")[1].split("<span class=\"a-size-base a-color-success a-text-bold\">")[1].split("</span>")[0].trim();
	}
	if (deliveryStr != "") {
		metadata.delivery = deliveryStr;
	}
//Mojo.Log.info("deliveryStr: " +deliveryStr);

	var serviceStr = "";
	if (serviceStr != "") {
		metadata.serviceclass = serviceStr;
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}


	var details = [];
	if (status > 0) {
		var dayMonthText = responseText.split("Latest update: ")[1].split("</span>")[0].trim();
//Mojo.Log.info("dayMonthText: " +dayMonthText);
		var detailsText = responseText.split("ship-track-time-grid\">");
		for (var i = 1; i < detailsText.length; i++) {
			var detailText = detailsText[i];
//Mojo.Log.info("detailsText[" + i + "]: " + detailsText[i]);
			var tmpDateStr = dayMonthText + " " + detailText.split("ship-track-fixed-column-top\">")[1].split("</div>")[0].trim();
//Mojo.Log.info("tmpDateStr: " + tmpDateStr);
			var tmpDetailsStr = detailText.split("ship-track-grid-responsive-column")[1].split("</div>")[0].trim();
			var tmpNotes = tmpDetailsStr.split("<span>")[1].split("</span>")[0].trim();
			var tmpLocFrag = tmpDetailsStr.split("class=\"a-color-secondary\">");
			var tmpLoc = "";

			if (tmpLocFrag.length > 1) {
				tmpLoc = tmpLocFrag[1].split("</span>")[0].trim();
			}

			if (deliveryStr.indexOf("Delivered") != -1 && status < 5) {
				status = 5;
			} else if (tmpNotes.indexOf("Out for delivery") != -1 && status < 4) {
				status = 4;
			} else if (tmpNotes.indexOf("Package has left the carrier facility") != -1 || tmpNotes.indexOf("Shipment departed") != -1 ||
					   tmpNotes.indexOf("Package has been") != -1 || tmpNotes.indexOf("Package received") != -1 ||
					   tmpNotes.indexOf("Package arrived") != -1 && status < 3) {
				status = 3;
			} else if (tmpNotes.indexOf("Package has left seller facility and is in transit to carrier") != -1 && status < 2) {
				status = 2;
			}
//Mojo.Log.info("tmpLoc: " + tmpLoc);
//Mojo.Log.info("tmpNotes: " +tmpNotes);
			if (detailText.indexOf("a-color-alternate-background") != -1 &&
				detailText.indexOf("a-text-bold") != -1) {
				dayMonthText = detailText.split("a-text-bold\">")[1].split("</span>")[0].trim();
			}
			details.push({date: tmpDateStr, location: tmpLoc, notes: tmpNotes});
		}
		
		this.callbackStatus(status);
		this.callbackDetails(details.clone());	
	} else {
		var errorText = "";

		if (errorText != "") {
			var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});
//Mojo.Log.info("error: " + errorText);
			details.push({date: dateTodayString, location: "", notes: errorText});
			this.callbackStatus(0);
			this.callbackDetails(details.clone());
		}
	}
};

Amazon.prototype.getDetailsRequestFailure = function(response) {
	this.callbackError($L("Error loading data from Amazon."));
};

registerService("Amazon", new Amazon());
