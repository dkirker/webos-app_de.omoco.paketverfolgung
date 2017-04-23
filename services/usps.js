function USPS() {
}

USPS.prototype.getAuthor = function() {
	return "Sebastian Hammerl, Donald Kirker";
}

USPS.prototype.getVersion = function() {
	return "1.1.1";
}

USPS.prototype.getColor = function() {
	return "#7298b2";
}

USPS.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

USPS.prototype.getTrackingUrl = function() {
	return "https://m.usps.com/m/TrackConfirmAction_detail?tLabels=" + this.id;	
}

USPS.prototype.getDetails = function() {
	var request = new Ajax.Request(this.getTrackingUrl(), {
		method: 'get',
		evalJS: 'false',
		evalJSON: 'false',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

USPS.prototype.getDetailsRequestSuccess = function(response) {
Mojo.Log.info("tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("responseText: " +responseText);
	//var responseText2 = responseText.split("<tbody class=\"details\">")[1];
	var statusFrag = responseText.split("<div class=\"package-note");//[1].split("</div>")[0];
	var statusText = "";
Mojo.Log.info("statusFrag: " + statusFrag);
	if (statusFrag.length > 1) {
		statusFrag = statusFrag[1].split("</div>")[0];
Mojo.Log.info("statusFrag: " + statusFrag);
	}
	if (statusFrag.indexOf("<h3>") != -1) {
		statusText = statusFrag.split("<h3>")[1].split("</h3>")[0].replace(/\:/g, " ").trim();
	}
	if (statusFrag.indexOf("<span>") != -1) {
		statusText += statusFrag.split("<span>")[1].split("</span>")[0].replace(/\:/g, " ").trim();
	}
Mojo.Log.info("statusText: " +statusText);
	// Real USPS statuses:
	//<div class="progress-indicator">
	//	<h2 class="hide-fromsighted">in-transit</h2>
	//</div>
	//
	// Values and Package Tracker values:
	// pre-shipment: 1 (pre shipment, pre-shipment info sent to usps, shipping label created)
	// accepted: 2 (picked up, arrived at post office, departed post office, arrived at usps origin facility ?)
	// in-transit: 3 (arrived at post office, departed post office, arrived at usps origin facility ?, arrived at usps facility, departed usps facility, processed through facility, sorting complete)
	// in-transit + special: 4 (out for delivery)
	// delivered: 5
	// alert: 3 (for now)
	// error: 0
	// seized: 0
	// archived: 0
	// 
	// 


	var status = 0;
	if (statusText.toLowerCase().indexOf("pre shipment") != -1 ||
		statusText.toLowerCase().indexOf("pre-shipment") != -1 ||
		statusText.toLowerCase().indexOf("on its way to usps") != -1) {
		status = 1;
	} else if (statusText.toLowerCase().indexOf("accepted") != -1) {
		status = 2;
	} else if (statusText.toLowerCase().indexOf("out for delivery") != -1 ||
			   statusText.toLowerCase().indexOf("out-for-delivery") != -1) {
		status = 4;
	} else if (statusText.toLowerCase().indexOf("in transit") != -1 ||
			   statusText.toLowerCase().indexOf("in-transit") != -1 ||
			   statusText.toLowerCase().indexOf("alert") != -1) {
        status = 3;
    } else if (statusText.toLowerCase().indexOf("delivered") != -1) {
		status = 5;
	} else {
		status = 0;
	}

	this.callbackStatus(status);

    // <div class="package-note">
    //  <h3>Expected Delivery Day:</h3>
    //  <span class="value">Thursday, May 5, 2016</span>
    // </div>
    // 
    // this.updateExpectedDelivery(...);
	// Expected Delivery Day:</h3>
	// Updated Delivery Day:</h3>
	// <span class="value">DATE_STR</span>
	var metadata = {};
	var deliveryFrag = responseText.split(" Delivery Day:</h3>");
	if (deliveryFrag.length > 1) {
		var deliveryStr = deliveryFrag[1].split("<span class=\"value\">")[1];
		var spanidx = 0;
		if (deliveryStr.toLowerCase().indexOf("<span class=\"value ") != -1) {
			spanidx = 1;
		}
		deliveryStr = deliveryStr.split("</span>")[spanidx].trim();
Mojo.Log.info("deliveryStr: " + deliveryStr);
		metadata.delivery = deliveryStr;
	} else if (statusText.toLowerCase().indexOf("delayed") != -1) {
		metadata.delivery = "Delayed";
	}

	var utagFrag = responseText.split("<script type=\"text/javascript\" id=\"tealiumUtagData\">")
	if (utagFrag.length > 1) {
		var serviceStr = null;
		/*var serviceFrag = utagFrag[1].split("{\"section\":\"track\",\"name\":\"m.trackconfirm.detail\",\"product\":\"")[1].split("\"}")[0];
		var serviceStr = serviceFrag.replace(/<(\/|\\)*SUP>/g,"");*/
		utagFrag = utagFrag[1].split("</script>")[0].trim();
		if (utagFrag.indexOf("utag_data = ") != -1) {
			utagFrag = utagFrag.split("utag_data = ")[1];
			var utagData = JSON.parse(utagFrag);

			if (utagData.product)
				serviceStr = utagData.product.replace(/<(\/|\\)*SUP>/g,"");
		}

		if (serviceStr != null && serviceStr !== "null") {
			metadata.serviceclass = serviceStr;
Mojo.Log.info("serviceStr: " + serviceStr);
		}
	} else if (responseText.indexOf("dataLayer.push") != -1) {
		var dataLayerText = responseText.split("dataLayer.push(")[1].split(")")[0];
		var dataLayer = JSON.parse(dataLayerText); // This could be dangerous!! TODO: Pick a better method?

		if (dataLayer && dataLayer.product && dataLayer.product !== "null")
			metadata.serviceclass = dataLayer.product;
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}


	var details = [];
	if (status > 0) {
		var scanHistory = responseText.split("<div class=\"scan-history")[1];
		var detailsText = scanHistory.split("<div class=\"package-note ui-border-dotted-bottom\">");
		for (var i = 1; i < detailsText.length; i++) {
Mojo.Log.info("detailsText[" + i + "]: " + detailsText[i]);
			var tmpDateStr = detailsText[i].split("<h3>")[1].split("<br />")[0].replace(/[\r]/g, " ").replace(/[^,: a-zA-Z0-9]/g, "").trim() + " " +
				detailsText[i].split("<br />")[1].split("</h3>")[0].replace(/[\r]/g, " ").replace(/[^,: a-zA-Z0-9]/g, "").trim();
Mojo.Log.info("tmpDateStr: " + tmpDateStr);
			var tmpLoc = "";
			var tmpNotes = "";
			/*if (i == 1) {
				tmpLoc = detailsSplit[1].split("<td class=\"location\">")[1].split("<p>")[1].split("</td>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
				tmpNotes = detailsSplit[1].split("<td class=\"status\">")[1].split("<p")[1].split("</p>")[0].split(">")[1].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
			
				if (tmpNotes.indexOf("Out for Delivery") != -1) {
					status = 4;
				} else if (tmpNotes.indexOf("Delivery status not updated") != -1) {
					status = 0;
				}			
			} else {*/
                tmpLoc = detailsText[i].split("<br/>")[1].split("</p>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
                tmpNotes = detailsText[i].split("<p>")[1].split("<br/>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").replace(/,/g, " ").trim();
			//}
Mojo.Log.info("tmpLoc: " + tmpLoc);
Mojo.Log.info("tmpNotes: " +tmpNotes);
			details.push({date: tmpDateStr, location: tmpLoc, notes: tmpNotes});
		}
		
		//this.callbackStatus(status);
		this.callbackDetails(details.clone());	
	} else {
		var errorFrag = responseText.split("<section class=\"list-view\">");//[1].split("</section>")[0];
Mojo.Log.info("errorFrag: " + errorFrag);
		if (errorFrag.length == 1) {
			errorFrag = responseText.split("<section class=\"content\">");
		}
Mojo.Log.info("errorFrag: " + errorFrag);
		if (errorFrag.length > 1) {
			errorFrag = errorFrag[1].split("</section>")[0];
		}
Mojo.Log.info("errorFrag: " + errorFrag);
		var errorText = "";
		var errorParts = errorFrag.split("<p");

		for (var i = 0; i < errorParts.length; i++) {
			if (i > 0)
				errorText = errorText + " ";
			errorText = errorText + errorParts[i].split("</p>")[0].substr(1).trim(); //.split(">")[1].trim();
		}
		errorText = errorText + " Check the tracking number and try again.";

		if (errorText != "") {
			var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});
//Mojo.Log.info("error: " + errorText);
			details.push({date: dateTodayString, location: "", notes: errorText});
			this.callbackStatus(0);
			this.callbackDetails(details.clone());
		}
	}
};

USPS.prototype.getDetailsRequestFailure = function(response) {
	this.callbackError($L("Error loading data from USPS."));
};

registerService("USPS", new USPS());
