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
Mojo.Log.info("USPS tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("USPS responseText: " +responseText);
	//var responseText2 = responseText.split("<tbody class=\"details\">")[1];
	var statusFrag = responseText.split("<div class=\"package-note");//[1].split("</div>")[0];
	var statusText = "";
	var statusSubText = "";

	if (statusFrag.length > 1) {
		statusFrag = statusFrag[1].split("</div>")[0];
Mojo.Log.info("USPS statusFrag[1]: " + statusFrag);
	} else {
		statusFrag = statusFrag[0];
Mojo.Log.info("USPS statusFrag[0]: " + statusFrag);
	}

	if (statusFrag.indexOf("<h3>") != -1) {
		statusText = statusFrag.split("<h3>")[1].split("</h3>")[0].replace(/\:/g, " ").trim();
	}
	// TODO: There was a reason for this, so need to handle better; might have been for alert or delivery attempt
	if (statusFrag.indexOf("<span>") != -1) {
		statusSubText = statusFrag.split("<span>")[1].split("</span>")[0].replace(/\:/g, " ").trim();
	}
	if (statusText == "") {
		statusText = statusSubText;
	}
Mojo.Log.info("USPS statusText: " +statusText);
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
	// held at post office: 4
	// status not available: 0
	// error: 0
	// not trackable: 0
	// seized: 0
	// archived: 0
	// 
	// 


	var status = 0;
	var statusTextLower = statusText.toLowerCase();
	if (statusTextLower.indexOf("pre shipment") != -1 ||
		statusTextLower.indexOf("pre-shipment") != -1 ||
		statusTextLower.indexOf("on its way to usps") != -1 ||
		statusTextLower.indexOf("label created") != -1 ||
		statusTextLower.indexOf("currently awaiting package") != -1) {
		status = 1;
	} else if (statusTextLower.indexOf("accepted") != -1) {
		status = 2;
	} else if (statusTextLower.indexOf("out for delivery") != -1 ||
		statusTextLower.indexOf("out-for-delivery") != -1 ||
statusTextLower.indexOf("delivery attempt") != -1 ||
statusTextLower.indexOf("notice left") != -1 ||
statusTextLower.indexOf("held at post office") != -1) {
		status = 4;
	} else if (statusTextLower.indexOf("in transit") != -1 ||
		statusTextLower.indexOf("in-transit") != -1 ||
		statusTextLower.indexOf("alert") != -1) {
status = 3;
} else if (statusTextLower.indexOf("delivered") != -1) {
		status = 5;
	} else {
		status = 0;
	}

	//this.callbackStatus(status, true);

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
	var delivery = responseText.split("Expected Delivery ");
	var deliveryFrag = (delivery.length > 1) ? delivery[1].split("</h3>") : [];

	if (deliveryFrag.length > 1) {
		var deliveryStr = deliveryFrag[1].split("<span class=\"value\">")[1];
		var spanidx = 0;
		if (deliveryStr.toLowerCase().indexOf("<span class=\"value ") != -1) {
			spanidx = 1;
		}
		deliveryStr = deliveryStr.split("</span>")[spanidx].trim();
Mojo.Log.info("USPS deliveryStr: " + deliveryStr);
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
Mojo.Log.info("USPS serviceStr: " + serviceStr);
		}
	} else if (responseText.indexOf("dataLayer.push") != -1) {
		var dataLayerText = responseText.split("dataLayer.push(")[1].split(")")[0];
		var dataLayer = JSON.parse(dataLayerText); // This could be dangerous!! TODO: Pick a better method?

		if (dataLayer) {
			if (dataLayer.product && dataLayer.product !== "null") {
				metadata.serviceclass = dataLayer.product;
			} else if (dataLayer.ecommerce &&
				dataLayer.ecommerce.impressions && dataLayer.ecommerce.impressions.length > 0) {
				var impressions = dataLayer.ecommerce.impressions;
				/*if (dataLayer.ecommerce.impressions[0].category.toLowerCase().indexOf("location not available") != -1) {
					status = 0;
				}*/
				if (impressions[0].name && impressions[0].name !== "Product Name Not Available") {
					metadata.serviceclass = impressions[0].name;
Mojo.Log.info("USPS serviceStr: " + metadata.serviceclass);

Mojo.Log.info("USPS impressions[0].dimension149="+impressions[0].dimension149);
					var features = (impressions[0].dimension149) ? impressions[0].dimension149.split("|") : [];
					for (var i = 0; i < features.length; i++) {
						var featureLower = features[i].toLowerCase();

						if (featureLower.indexOf("usps tracking") == -1) {
							metadata.serviceclass += ", " + features[i].trim();
						}
					}
Mojo.Log.info("USPS serviceStr: " + metadata.serviceclass);
				}
			}
		}
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}


	var details = [];
	if (status > 0) {
		var scanHistory = responseText.split("<div class=\"scan-history")[1];
		var detailsText = scanHistory.split("<div class=\"package-note ui-border-dotted-bottom\">");
		for (var i = 1; i < detailsText.length; i++) {
Mojo.Log.info("USPS detailsText[" + i + "]: " + detailsText[i]);
			var tmpDateStr = detailsText[i].split("<h3>")[1].split("<br />")[0].replace(/[\r]/g, " ").replace(/[^,: a-zA-Z0-9]/g, "").trim() + " " +
				detailsText[i].split("<br />")[1].split("</h3>")[0].replace(/[\r]/g, " ").replace(/[^,: a-zA-Z0-9]/g, "").trim();
Mojo.Log.info("USPS tmpDateStr: " + tmpDateStr);
			var tmpLoc = "";
			var tmpNotes = "";
			/*if (i == 1) {
				tmpLoc = detailsSplit[1].split("<td class=\"location\">")[1].split("<p>")[1].split("</td>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
				tmpNotes = detailsSplit[1].split("<td class=\"status\">")[1].split("<p")[1].split("</p>")[0].split(">")[1].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
			
				if (tmpNotes.toLowerCase().indexOf("out for delivery") != -1) {
					status = 4;
				} else if (tmpNotes.toLowerCase().indexOf("delivery status not updated") != -1) {
					status = 0;
				}			
			} else {*/

			/*
                tmpLoc = detailsText[i].split("<br/>")[1].split("</p>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
                tmpNotes = detailsText[i].split("<p>")[1].split("<br/>")[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").replace(/,/g, " ").trim();
			*/
			
			var detailsBlock = detailsText[i].split("</p>")[0].split("<p>")[1].split("<br/>");

			tmpNotes = detailsBlock[0].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").replace(/,$/, " ").trim();
			tmpLoc = detailsBlock[1].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
			if (detailsBlock.length > 2) {
				for (var j = 2; j < detailsBlock.length; j++) {
					tmpNotes += "<br/>" + detailsBlock[j].replace(/[\r]/g, " ").replace(/&nbsp;/g, " ").trim();
				}
			}

			//}
Mojo.Log.info("USPS tmpLoc: " + tmpLoc);
Mojo.Log.info("USPS tmpNotes: " +tmpNotes);

			//if (i == 1) {
				if (detailsText.length == 2 && tmpNotes.toLowerCase().indexOf("usps expects item for mailing") != -1) {
					status = 1;
				} else if (status < 4 && tmpNotes.toLowerCase().indexOf("out for delivery") != -1) {
					status = 4;
					//this.callbackStatus(status);
				} else if (i == 1 && tmpNotes.toLowerCase().indexOf("delivery status not updated") != -1) {
					status = 0;
					//this.callbackStatus(status);
				} else if (status < 4 && tmpNotes.toLowerCase().indexOf("held at post office") != -1) {
					status = 4;
					//this.callbackStatus(status);
				}
			//}
			details.push({date: tmpDateStr, location: tmpLoc, notes: tmpNotes});
		}

		if (detailsText.length == 1) {
			var detailFrag = responseText.split("<div class=\"package-note");
			var detailText = "";
Mojo.Log.info("USPS detailFrag: " + detailFrag);
			if (detailFrag.length > 2) { // First one was package status
				detailFrag = detailFrag[2].split("</div>")[0];
Mojo.Log.info("USPS detailFrag: " + detailFrag);
				if (detailFrag.indexOf("<span>") != -1) {
					detailText = detailFrag.split("<span>")[1].split("</span>")[0];

					if (detailText.indexOf("<br/>") != -1) {
						detailText = detailText.split("<br/>")[0].trim();
					}
					detailText = statusText + "<br/><br/>" + detailText;

					var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});
					details.push({date: dateTodayString, location: "", notes: detailText});
				}
			}
		}
		
		this.callbackStatus(status, true);
		this.callbackDetails(details.clone());	
	} else {
		var useDefaultErrorHandling = true;
		var errorText = "";
		if (statusText.toLowerCase().indexOf("not trackable") != -1 || statusText.toLowerCase().indexOf("status not available") != -1) {
Mojo.Log.info("USPS Got Not Trackable");
			var notes = responseText.split("<div class=\"package-note");
			if (notes.length > 2) { // There should be [{block before statusText},{statusText},{errorFrag}]
				useDefaultErrorHandling = false;

				var errorFrag = notes[2].split("<span>");
Mojo.Log.info("USPS errorFrag: " + (errorFrag.length > 1) ? errorFrag[1] : errorFrag);
				if (errorFrag.length > 1) {
					errorText = errorFrag[1].split("</span>")[0].trim();
				} else {
					errorText = errorFrag[0].trim();
				}
Mojo.Log.info("USPS errorText: " + errorText);
			}
		}
		
		if (useDefaultErrorHandling) {
			var errorFrag = responseText.split("<section class=\"list-view\">");//[1].split("</section>")[0];
Mojo.Log.info("USPS errorFrag: " + errorFrag);
			if (errorFrag.length == 1) {
				errorFrag = responseText.split("<section class=\"content\">");
			}
Mojo.Log.info("USPS errorFrag: " + errorFrag);
			if (errorFrag.length > 1) {
				errorFrag = errorFrag[1].split("</section>")[0];
			}
Mojo.Log.info("USPS errorFrag: " + errorFrag);
			var errorParts = errorFrag.split("<p");

			for (var i = 0; i < errorParts.length; i++) {
				if (i > 0)
					errorText += " ";
				errorText += errorParts[i].split("</p>")[0].substr(1).trim(); //.split(">")[1].trim();
			}
			errorText += " Check the tracking number and try again.";
		}

		if (errorText != "") {
			var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});
//Mojo.Log.info("USPS error: " + errorText);
			details.push({date: dateTodayString, location: "", notes: errorText});
			// Force update with "true"
			this.callbackStatus(0, true);
			this.callbackDetails(details.clone(), true);
		}
	}
};

USPS.prototype.getDetailsRequestFailure = function(response) {
	this.callbackError($L("Error loading data from USPS."));
};

registerService("USPS", new USPS());
