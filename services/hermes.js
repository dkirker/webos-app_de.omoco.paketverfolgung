function Hermes() {
}

Hermes.prototype.getAuthor = function() {
	return "Donald Kirker, Sebastian Hammerl";
}

Hermes.prototype.getVersion = function() {
	return "1.1";
}

Hermes.prototype.getColor = function() {
	return "#0091cd";
}

Hermes.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

Hermes.prototype.getTrackingUrl = function() {
	// TODO: Handle other locales
	return "https://www.hermesworld.com/en/our-services/distribution/parcel-delivery/parcel-tracking/?trackingNo=" + this.id;
}

Hermes.prototype.getDetails = function() {
	var request = new Ajax.Request("https://www.hermesworld.com/TrackMyParcel/customersearch.json?trackingNumber=" + this.id, {
		method: "get",
		evalJS: "false",
		evalJSON: "true",
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

// {"parcels":[
// 		{"barcode":"################","postcode":"XXX  XXX","tracking":[
// 			{"date":"21/06/2018","time":"17:10","status":"Delivered and signed for","id":"1028"},
// 			{"date":"21/06/2018","time":"06:19","status":"On its way to the courier","id":"1022"},
// 			{"date":"20/06/2018","time":"22:12","status":"At the customers local depot","id":"22"},
// 			{"date":"20/06/2018","time":"22:10","status":"At the customers local depot","id":"27"},
// 			{"date":"20/06/2018","time":"15:10","status":"At the national sorting hub","id":"28"},
// 			{"date":"19/06/2018","time":"13:54","status":"Entered the Hermes network","id":"1253"},
// 			{"date":"18/06/2018","time":"11:37","status":"Collected by the courier","id":"1261"},
// 			{"date":"18/06/2018","time":"07:28","status":"Collection request received","id":"1328"}
// 		]}
// 	]}

Hermes.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;
Mojo.Log.info("Hermes responseJson: " + Object.toJSON(json));
    Mojo.Log.info("Hermes Status: ", response.statusText, " Response: ", response.responseText,
                  " Headers: ", Object.toJSON(response.headerJSON),
                  " Response JSON: ", Object.toJSON(response.responseJSON));

	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || !json.parcels || json.parcels.length == 0 ||
		!json.parcels[0].tracking || json.parcels[0].tracking.length == 0) {
			this.callbackStatus(-1);
			return;
	}
Mojo.Log.info("Hermes responseJson: " + Object.toJSON(json));

	var tracking = json.parcels[0].tracking;

	var status = 0;
	var statusText = tracking[0].status;

Mojo.Log.info("Hermes statusText: " + statusText);

	switch (statusText.toLowerCase()) {
		case "collection request received":
			status = 1;
			break;
		case "collected by the courier":
			status = 2;
			break;
		case "entered the Hermes network":
		case "at the national sorting hub":
		case "at the customers local depot":
			status = 3;
			break;
		case "on its way to the courier":
			status = 4;
			break;
		case "delivered":
		case "delivered and signed for":
			status = 5;
			break;
	}
Mojo.Log.info("Hermes status: " + status);

	var details = [];
	if(status > 0) {
		for (var i = 0; i < tracking.length; i++) {
			details.push({date: tracking[i].date + " " + tracking[i].time, location: "", notes: tracking[i].status});
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

Hermes.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("Hermes Status: ", response.statusText, " Response: ", response.responseText,
				  " Headers: ", Object.toJSON(response.headerJSON),
				  " Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error."));
};

registerService("Hermes", new Hermes());
