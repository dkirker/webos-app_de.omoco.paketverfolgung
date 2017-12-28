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
    var responseText = response.responseText.split("<body")[1];
    
    if (responseText.indexOf("ship-track-time-grid") != -1) {
Mojo.Log.info("AMZ using details A");
        this.getDetailsA({responseText: responseText});
    } else if (responseText.indexOf("tracking-events-container") != -1) {
Mojo.Log.info("AMZ using details B");
        this.getDetailsB({responseText: responseText});
    } else {
Mojo.Log.info("AMZ unable to read details");
        //this.callbackStatus(-1);
        this.callbackError($L("Error loading data from Amazon."));
    }
};
	
Amazon.prototype.getDetailsA = function(response) {
Mojo.Log.info("AMZ tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("AMZ responseText: " +responseText);
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
Mojo.Log.info("AMZ status: " +status);
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
Mojo.Log.info("AMZ deliveryStr: " +deliveryStr);

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
Mojo.Log.info("AMZ dayMonthText: " +dayMonthText);
		var detailsText = responseText.split("ship-track-time-grid\">");
		for (var i = 1; i < detailsText.length; i++) {
			var detailText = detailsText[i];
Mojo.Log.info("AMZ detailsText[" + i + "]: " + detailsText[i]);
			var tmpDateStr = dayMonthText + " " + detailText.split("ship-track-fixed-column-top\">")[1].split("</div>")[0].trim();
Mojo.Log.info("AMZ tmpDateStr: " + tmpDateStr);
			var tmpDetailsStr = detailText.split("ship-track-grid-responsive-column")[1].split("</div>")[0].trim();
			var tmpNotes = tmpDetailsStr.split("<span>")[1].split("</span>")[0].trim();
			var tmpLocFrag = tmpDetailsStr.split("class=\"a-color-secondary\">");
			var tmpLoc = "";

			if (tmpLocFrag.length > 1) {
				tmpLoc = tmpLocFrag[1].split("</span>")[0].trim();
			}

			if ((tmpNotes.indexOf("Delivered") != -1 || tmpNotes.indexOf("Available for pickup") != -1) && status < 5) {
				status = 5;
			} else if (tmpNotes.indexOf("Out for delivery") != -1 && status < 4) {
				status = 4;
			} else if ((tmpNotes.indexOf("Package has left the carrier facility") != -1 || tmpNotes.indexOf("Shipment departed") != -1 ||
					    tmpNotes.indexOf("Package has been") != -1 || tmpNotes.indexOf("Package received") != -1 ||
					    tmpNotes.indexOf("Package arrived") != -1 || tmpNotes.indexOf("Shipment arrived") != -1) && status < 3) {
				status = 3;
			} else if (tmpNotes.indexOf("Package has left seller facility and is in transit to carrier") != -1 && status < 2) {
				status = 2;
			} else if (status && responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
				status = 0;
			}
Mojo.Log.info("latest AMZ status: " + status);
Mojo.Log.info("AMZ tmpLoc: " + tmpLoc);
Mojo.Log.info("AMZ tmpNotes: " +tmpNotes);
			if (detailText.indexOf("a-color-alternate-background") != -1 &&
				detailText.indexOf("a-text-bold") != -1) {
				dayMonthText = detailText.split("a-text-bold\">")[1].split("</span>")[0].trim();
Mojo.Log.info("AMZ dayMonthText: " +dayMonthText);
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
Mojo.Log.info("AMZ tracking # " + this.id);
	var responseText = response.responseText;
Mojo.Log.info("AMZ responseText: " +responseText);
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
    if (responseText.indexOf("Ordered <span class=\"nowrap\"") != -1) {
        status = 1;
    } else if (deliveryFrag.length > 1 && deliveryFrag[1].split("</span>")[0].indexOf("Delivered <span") != -1) {
        status = 5;
    } else { 
        this.callbackStatus(0);
    }
Mojo.Log.info("AMZ status: " +status);
	// Defer this
	//this.callbackStatus(status);

	var metadata = {};
	var deliveryStr = "";
	if (deliveryFrag.length > 1) {
		deliveryStr = deliveryFrag[1].split("<span class=\"nowrap\">")[1].split("</span>")[0].trim();
	}
	if (deliveryStr != "") {
		metadata.delivery = deliveryStr;
	}
Mojo.Log.info("AMZ deliveryStr: " +deliveryStr);

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
		var dayRow = responseText.split("<div class=\"a-row tracking-event-date-header\">");
		for (var j = 1; j < dayRow.length; j++) { // Date Row
            dayMonthText = dayRow[j].split("<span class=\"tracking-event-date\">")[1].split("</span>")[0].trim();
Mojo.Log.info("AMZ dayMonthText: " +dayMonthText);
            
            var detailsText = dayRow[j].split("<div class=\"a-row a-spacing-large a-spacing-top-medium\">");
            for (var i = 1; i < detailsText.length; i++) {
                var detailText = detailsText[i];
    Mojo.Log.info("AMZ detailsText[" + i + "]: " + detailsText[i]);
                var tmpDateStr = dayMonthText + " " + detailText.split("<span class=\"tracking-event-time\">")[1].split("</span>")[0].trim();
    Mojo.Log.info("AMZ tmpDateStr: " + tmpDateStr);
                var tmpNotes = detailText.split("<span class=\"tracking-event-message\">")[1].split("</span>")[0].trim();
                var tmpLoc = detailText.split("<span class=\"tracking-event-location\">")[1].split("</span")[0].trim();

                if ((tmpNotes.indexOf("Delivered") != -1 || tmpNotes.indexOf("Available for pickup") != -1) && status < 5) {
                    status = 5;
                } else if (tmpNotes.indexOf("Out for delivery") != -1 && status < 4) {
                    status = 4;
                } else if ((tmpNotes.indexOf("Package has left the carrier facility") != -1 || tmpNotes.indexOf("Shipment departed") != -1 ||
                            tmpNotes.indexOf("Package has been") != -1 || tmpNotes.indexOf("Package received") != -1 ||
                            tmpNotes.indexOf("Package arrived") != -1 || tmpNotes.indexOf("Shipment arrived") != -1) && status < 3) {
                    status = 3;
                } else if (tmpNotes.indexOf("Package has left seller facility and is in transit to carrier") != -1 && status < 2) {
                    status = 2;
                } else if (status && responseText.indexOf("<h4 class=\"a-alert-heading\">Delayed") != -1) {
                    status = 0;
                }
    Mojo.Log.info("latest AMZ status: " + status);
    Mojo.Log.info("AMZ tmpLoc: " + tmpLoc);
    Mojo.Log.info("AMZ tmpNotes: " +tmpNotes);

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
