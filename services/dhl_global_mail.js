function DHLGM() {
}

DHLGM.prototype.getAuthor = function() {
	return "Sebastian Hammerl";
}

DHLGM.prototype.getVersion = function() {
	return "1.0";
}

DHLGM.prototype.getColor = function() {
	return "#f1d871";
}

DHLGM.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

DHLGM.prototype.getTrackingUrl = function() {
	return "https://webtrack.dhlglobalmail.com/?trackingnumber=" + this.id;
}

DHLGM.prototype.getDetails = function() {
	var request = new Ajax.Request(this.getTrackingUrl(), {
		method: 'get',
		evalJS: 'false',
		evalJSON: 'false',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

DHLGM.prototype.getDetailsRequestSuccess = function(response) {
	var responseText = response.responseText;

Mojo.Log.info("DHL GM responseText = " + responseText);

	var status = 0;
	var statusFrag = responseText.split("class=\"status-info\">");
	if (statusFrag.length > 1) {
Mojo.Log.info("DHL GM statusFrag = ", statusFrag);
		if (statusFrag[1].indexOf("<h2>Picked Up</h2>") != -1) { // Need confirm
			status = 1;
		} else if (statusFrag[1].indexOf("<h2>Processed</h2>") != -1) { // Need confirm
			status = 2;
		} else if (statusFrag[1].indexOf("<h2>En Route</h2>") != -1) {
			var statusDescrip = statusFrag[1].split("<em class=\"status-description\">");
			status = 3; // statusDescrip[1].indexOf("Tendered to Service Provider" )
			if (statusDescrip && statusDescrip[1].indexOf("Out for Delivery") != -1) {
				status = 4;
			}
		} else if (statusFrag[1].indexOf("<h2>Delivered</h2>") != -1) { // Need confirm
			status = 5;
		} 
	} else if (responseText.indexOf("<h4>No Results</h4>") != -1) {
		status = -1;
	}
Mojo.Log.info("DHL GM Status: " + status);
	this.callbackStatus(status);

	if(status > 0) {
		var metadata = {};
		var deliveryParts = responseText.split("<h4>Estimated Delivery");

		if (deliveryParts.length > 1) {
			var deliveryStr = deliveryParts[1].split("</h4>")[1].split("<p>")[1].split("</p>")[0];
			metadata.delivery = deliveryStr;
Mojo.Log.info("DHL GM Delivery: " + deliveryStr);
		}

		var serviceParts = responseText.split("<dt>Service</dt>");

		if (serviceParts.length > 1) {
			metadata.serviceclass = serviceParts[1].split("<dd>")[1].split("</dd>")[0];
Mojo.Log.info("DHL GM Service: " + metadata.serviceclass);
		}

		if (metadata != {}) {
			this.callbackMetadata(metadata);
		}

		var activityFrag = responseText.split("Activity</h4>")[1];
		var details = [];
		var eventDateStr = activityFrag.split("<li class=\"timeline-date\">")[1].split("</li>")[0];
		var details2 = activityFrag.split("<li class=\"timeline-event");
Mojo.Log.info("DHL GM eventDateStr = " + eventDateStr);

		for (var i=1; i<details2.length; i++) {
			var tmpTimeFrag = details2[i].split("timeline-time\"><em>")[1];
			var tmpTime = tmpTimeFrag.split("</em>")[0] + " " + tmpTimeFrag.split("</em>")[1].split("</div>")[0];
Mojo.Log.info("DHL GM tmpTime = " + tmpTime);
			var tmpDate = eventDateStr + " " + tmpTime;
Mojo.Log.info("DHL GM tmpDate = " + tmpDate);
			var tmpLoc = details2[i].split("<div class=\"timeline-location\">")[1].split("</div>")[0].trim();
Mojo.Log.info("DHL GM tmpLoc = " + tmpLoc);
			var tmpNotes = details2[i].split("<div class=\"timeline-description\">")[1].split("</div>")[0];
Mojo.Log.info("DHL GM tmpNotes = " + tmpNotes);

			details.push({date: tmpDate, location: tmpLoc, notes: tmpNotes});

			var eventDateFrag = details2[i].split("<li class=\"timeline-date\">");
			if (eventDateFrag.length > 1) {
				eventDateStr = eventDateFrag[1].split("</li>")[0];
Mojo.Log.info("DHL GM eventDateStr = " + eventDateStr);
			}
		}
		
		//details = details.reverse();
		
		this.callbackDetails(details.clone());	
	} else if (status == -1) {
		var details = [];
		var errorText = responseText.split("<h4>No Results</h4>")[1].split("<p>")[1].split("</p>")[0].trim();

		var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});
Mojo.Log.info("DHL GM error: " + errorText);
		details.push({date: dateTodayString, location: "", notes: errorText});
		this.callbackStatus(0);
		this.callbackDetails(details.clone());
	}
};

DHLGM.prototype.getDetailsRequestFailure = function(response) {
	this.callbackError("Konnte Seite nicht laden.");
};

registerService("DHL Global Mail", new DHLGM());

