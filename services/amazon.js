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
	var responseSplit = response.responseText.split("<body");
	var responseText = responseSplit[1];
	var headText = responseSplit[0];

	if (responseText.indexOf("ship-track-time-grid") != -1) {
Mojo.Log.info("AMZ using details A");
		this.getDetailsA({responseText: responseText});
	} else if (responseText.indexOf("tracking-events-container") != -1) {
Mojo.Log.info("AMZ using details B");
		this.getDetailsB({responseText: responseText, headText: headText});
	} else {
Mojo.Log.info("AMZ unable to read details");
		//this.callbackStatus(-1);
		this.callbackError($L("Error loading data from Amazon."));
	}
};
	
Amazon.prototype.getDetailsA = function(response) {
Mojo.Log.info("AMZ-A tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("AMZ-A responseText: " +responseText);
//	var statusText = "";
//Mojo.Log.info("AMZ statusFrag: " + statusText);


	var status = 0;
	if (responseText.indexOf("<span class=\"delivery-status\"") != -1) {
		status = 5;
	} else if (responseText.indexOf("<span class=\"shipped-status\"") != -1) {
        status = 3;
    } else if (responseText.indexOf("<span class=\"ordered-status\"") != -1) {
		status = 1;
	} else if (responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
		status = 1; // TODO: Error status
	} else {
		status = 1; //0;
	}
Mojo.Log.info("AMZ-A status: " +status);
	// Defer this
	//this.callbackStatus(status);

	var metadata = {};
	var deliveryStr = "";
	var deliveryFrag = responseText.split("<span class=\"delivery-date\">");
	if (deliveryFrag.length > 1) {
		deliveryStr = deliveryFrag[1].split("</span>")[0].trim();
	} else { // We must have mobile...
		deliveryStr = responseText.split("<div class=\"a-column a-span12 shipment-status-content\">")[1].split("<span ")[1].split("a-text-bold\">")[1].split("</span>")[0].trim();
	}
	if (deliveryStr != "") {
		metadata.delivery = deliveryStr;
	}
Mojo.Log.info("AMZ-A deliveryStr: " +deliveryStr);

	var serviceStr = "";
	if (serviceStr != "") {
		metadata.serviceclass = serviceStr;
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}


	var details = [];
	if (status > 0) {
		var dayMonthText = ""
		var dayMonthFrag = responseText.split("Latest update: ");
		
		if (dayMonthFrag.length > 1) {
			dayMonthText = dayMonthFrag[1].split("</span>")[0].trim();
		} else {
			dayMonthText = Mojo.Format.formatDate(new Date(), {date: "long"});
		}
Mojo.Log.info("AMZ-A dayMonthText: " +dayMonthText);
		var detailsText = responseText.split("ship-track-time-grid\">");
		for (var i = 1; i < detailsText.length; i++) {
			var detailText = detailsText[i];
Mojo.Log.info("AMZ-A detailsText[" + i + "]: " + detailsText[i]);
			var tmpDateStr = dayMonthText + " " + detailText.split("ship-track-fixed-column-top\">")[1].split("</div>")[0].trim();
Mojo.Log.info("AMZ-A tmpDateStr: " + tmpDateStr);
			var tmpDetailsStr = detailText.split("ship-track-grid-responsive-column")[1].split("</div>")[0].trim();
			var tmpNotes = tmpDetailsStr.split("<span>")[1].split("</span>")[0].trim();
			var tmpLocFrag = tmpDetailsStr.split("class=\"a-color-secondary\">");
			var tmpLoc = "";

			if (tmpLocFrag.length > 1) {
				tmpLoc = tmpLocFrag[1].split("</span>")[0].trim();
			}

			if (status < 5 && (tmpNotes.indexOf("Delivered") != -1 || tmpNotes.indexOf("Available for pickup") != -1)) {
				status = 5;
			} else if (status < 4 && tmpNotes.indexOf("Out for delivery") != -1) {
				status = 4;
			} else if (status < 3 && (tmpNotes.indexOf("Package has left the carrier facility") != -1 || tmpNotes.indexOf("Shipment departed") != -1 ||
					    tmpNotes.indexOf("Package has been") != -1 || tmpNotes.indexOf("Package received") != -1 ||
					    tmpNotes.indexOf("Package arrived") != -1 || tmpNotes.indexOf("Shipment arrived") != -1)) {
				status = 3;
			} else if (status < 2 && tmpNotes.indexOf("Package has left seller facility and is in transit to carrier") != -1) {
				status = 2;
			} else if (status && responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
				status = 0;
			}
Mojo.Log.info("latest AMZ-A status: " + status);
Mojo.Log.info("AMZ-A tmpLoc: " + tmpLoc);
Mojo.Log.info("AMZ-A tmpNotes: " +tmpNotes);
			if (detailText.indexOf("a-color-alternate-background") != -1 &&
				detailText.indexOf("a-text-bold") != -1) {
				dayMonthText = detailText.split("a-text-bold\">")[1].split("</span>")[0].trim();
Mojo.Log.info("AMZ-A dayMonthText: " +dayMonthText);
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

Amazon.prototype.getDetailsB = function(response) {
Mojo.Log.info("AMZ-B tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("AMZ-B responseText: " +responseText);
//	var statusText = "";
//Mojo.Log.info("AMZ statusFrag: " + statusText);


	var status = 0;
	/*if (responseText.indexOf("<span class=\"delivery-status\"") != -1) {
		status = 5;
	} else if (responseText.indexOf("<span class=\"shipped-status\"") != -1) {
        status = 3;
    } else if (responseText.indexOf("<span class=\"ordered-status\"") != -1) {
		status = 1;
	} else if (responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
		status = 1; // TODO: Error status
	} else {
		status = 1; //0;
	}*/
	// TODO: Parse this better
	var deliveryFrag = responseText.split("<span id=\"primaryStatus\"");
	/*if (responseText.indexOf("Ordered <span class=\"nowrap\"") != -1) {
		status = 1;
	} else if (deliveryFrag.length > 1 && deliveryFrag[1].split("</span>")[0].indexOf("Delivered <span") != -1) {
		status = 5;
	} else { 
		this.callbackStatus(0);
	}
Mojo.Log.info("AMZ status: " +status);*/
	// Defer this
	//this.callbackStatus(status);

	var metadata = {};
	var deliveryStr = "";
	var aStateStr = response.headText.split("page-state");
	var aStateJson = {};

	if (aStateStr.length > 1) {
		aStateStr = aStateStr[1].split("\">")[1].split("</script>")[0];
Mojo.Log.info("AMZ-B aStateStr = " + aStateStr);
		aStateJson = JSON.parse(aStateStr);
	}

	// {"deviceType":"desktop","progressTracker":{"lastTransitionPercentComplete":92,"lastReachedMilestone":"SHIPPED","numberOfReachedMilestones":2},"itemId":"xxxxxxxxxxxx","orderId":"XXX-XXXXXXX-XXXXXXX","isMfn":false,"shortStatus":"IN_TRANSIT","realm":"USAmazon","promise":{"secondaryPromiseIdentifier":"NONE","promiseMessage":"Arriving tomorrow by 8PM"},"themeParameters":"o=XXX-XXXXXXX-XXXXXXX&i=xxxxxxxxxxxx","visitTrigger":"UNKNOWN","trackingId":"TBA000000000000"}
	// {"deviceType":"desktop","orderId":"XXX-XXXXXXX-XXXXXXX","shortStatus":"DELIVERED","promise":{"secondaryPromiseIdentifier":"DELIVERED","promiseMessage":"Delivered today"},"packageIndex":"0","themeParameters":"o=XXX-XXXXXXX-XXXXXXX&s=0000000000000&p=0&i=","progressTracker":{"lastTransitionPercentComplete":100,"lastReachedMilestone":"DELIVERED","numberOfReachedMilestones":4},"itemId":"","isMfn":false,"shipmentId":"0000000000000","realm":"USAmazon","visitTrigger":"UNKNOWN","trackingId":"TBA000000000000"}
	// shortStatus
	// ORDERED
	// SHIPPED
	// IN_TRANSIT
	// OUT_FOR_DELIVERY
	// AVAILABLE_FOR_PICKUP
	// DELIVERED
	// PICKED_UP
	if (aStateJson != {} && aStateJson.promise && aStateJson.promise.promiseMessage) {
		deliveryStr = aStateJson.promise.promiseMessage;
Mojo.Log.info("AMZ-B aState deliveryStr = " + deliveryStr);
	} else if (deliveryFrag.length > 1) {
		deliveryStr = deliveryFrag[1].split("<span class=\"nowrap\">")[1].split("</span>")[0].trim();
	}

	var primaryDeliveryFrag = responseText.split("<span class=\"milestone-primaryMessage");
	if (primaryDeliveryFrag.length > 4) {
		var primaryDeliveryStr = primaryDeliveryFrag[4].split("</span>")[0].split(">")[1].trim();

		deliveryStr = primaryDeliveryStr + " - " + deliveryStr;
	}

	if (deliveryStr != "") {
		metadata.delivery = deliveryStr;
	}
Mojo.Log.info("AMZ-B deliveryStr: " +deliveryStr);

	var serviceStr = "";
	if (serviceStr != "") {
		metadata.serviceclass = serviceStr;
	}

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	// Better handling of status
	var shortStatus = null;
	if (aStateJson != {} && aStateJson.shortStatus) {
		shortStatus = aStateJson.shortStatus.toLowerCase();
		var shortStatusMap = {
				"ordered": 1,
				"shipped": 2,
				"in_transit": 3,
				"out_for_delivery": 4,
				"available_for_pickup": 4, // 5? Or should this be a new class?
				"picked_up": 5,
				"delivered": 5
			};
Mojo.Log.info("AMZ-B shortStatus: " + shortStatus);

		if (shortStatusMap.hasOwnProperty(shortStatus)) {
			status = shortStatusMap[shortStatus];
		}
	} else {
		if (responseText.indexOf("Ordered <span class=\"nowrap\"") != -1) {
			status = 1;
		} else if (deliveryFrag.length > 1 && deliveryFrag[1].split("</span>")[0].indexOf("Delivered <span") != -1) {
			status = 5;
		} else {
			this.callbackStatus(0);
		}
	}
Mojo.Log.info("AMZ-B new status: " + status);


	// If status is delivered, see if the delivery photo exists! We can add support for delivery photos and signed-for/proof-of-delivery images!
	// <div id="photoOnDelivery-container" class="a-row a-spacing-small widgetContainer">
	//
	//     <img alt="" src="https://us-prod-temp.s3.amazonaws.com/imageId-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Date=20190313T231049Z&amp;X-Amz-SignedHeaders=host&amp;X-Amz-Expires=521350&amp;X-Amz-Credential=AKIAJB4SCPO5JPGKY7AQ%2F20190313%2Fus-east-1%2Fs3%2Faws4_request&amp;X-Amz-Signature=cce13e75953efa21d4c09a766d42283b1fd73c7b156ed2c91d0f22d954441c90">
	//

	var details = [];
	if (status > 0) {
		var dayMonthText = ""
		var dayRow = responseText.split("<div class=\"a-row tracking-event-date-header\">");
		for (var j = 1; j < dayRow.length; j++) { // Date Row
            dayMonthText = dayRow[j].split("<span class=\"tracking-event-date\">")[1].split("</span>")[0].trim();
Mojo.Log.info("AMZ-B dayMonthText: " +dayMonthText);
            
            var detailsText = dayRow[j].split("<div class=\"a-row a-spacing-large a-spacing-top-medium\">");
            for (var i = 1; i < detailsText.length; i++) {
                var detailText = detailsText[i];
    Mojo.Log.info("AMZ-B detailsText[" + i + "]: " + detailsText[i]);
                var tmpDateStr = dayMonthText + " " + detailText.split("<span class=\"tracking-event-time\">")[1].split("</span>")[0].trim();
    Mojo.Log.info("AMZ-B tmpDateStr: " + tmpDateStr);
                var tmpNotes = detailText.split("<span class=\"tracking-event-message\">")[1].split("</span>")[0].trim();
                var tmpLoc = detailText.split("<span class=\"tracking-event-location\">")[1].split("</span")[0].trim();

				var tmpNotesLower = tmpNotes.toLowerCase();
                if (status < 5 && ((tmpNotesLower.indexOf("delivered") != -1 && shortStatus != "available_for_pickup") || tmpNotesLower.indexOf("package picked up") != -1)) {
                    status = 5;
                } else if (status < 4 && (tmpNotesLower.indexOf("out for delivery") != -1 || tmpNotesLower.indexOf("available for pickup") != -1)) {
                    status = 4;
                } else if (status < 3 && (tmpNotesLower.indexOf("package has left the carrier facility") != -1 || tmpNotesLower.indexOf("shipment departed") != -1 ||
                            tmpNotesLower.indexOf("package has been") != -1 || tmpNotesLower.indexOf("package received") != -1 ||
                            tmpNotesLower.indexOf("package arrived") != -1 || tmpNotesLower.indexOf("shipment arrived") != -1)) {
                    status = 3;
                } else if (status < 2 && tmpNotesLower.indexOf("package has left seller facility and is in transit to carrier") != -1) {
                    status = 2;
                } else if (status && responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
                    status = 0;
                }
    Mojo.Log.info("latest AMZ-B status: " + status);
    Mojo.Log.info("AMZ-B tmpLoc: " + tmpLoc);
    Mojo.Log.info("AMZ-B tmpNotes: " + tmpNotes);

                details.push({date: tmpDateStr, location: tmpLoc, notes: tmpNotes});
            }
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
