function PapaJohns() {
}

PapaJohns.prototype.getAuthor = function() {
	return "Donald Kirker";
}

PapaJohns.prototype.getVersion = function() {
	return "1.1";
}

PapaJohns.prototype.getColor = function() {
	return "#ab131b";
}

PapaJohns.prototype._getJsonFromUrl = function(url) {
	var query = "";
	var result = {};

	var pos = url.indexOf("?");
	if(pos==-1) return {};
	query = url.split("?")[1];

	var parts = query.split("&");
	for (var i = 0; i < parts.length; i++) {
		var item = parts[i].split("=");
		result[decodeURIComponent(item[0])] = decodeURIComponent(item[1]);
	}
	return result;
}

PapaJohns.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	var trackingUrl = id;

	// https://www.papajohns.com/papa-track?orderType=DELIVERY&storeId=####&orderId=####&subId=XXXX
	// Make sure string starts with https:// otherwise sanitize
	if (id.indexOf("https://") != 0) {
		trackingUrl = "https://" + id;
	}
	var params = this._getJsonFromUrl(trackingUrl);

	this.orderNum = params.orderId;
	this.subId = params.subId;

	this.id = trackingUrl;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

PapaJohns.prototype.getTrackingUrl = function() {
	//this.orderNum = ;
	//this.subId = ;
	//return "https://papajohns-api-prod.apigee.net/api/v1/orders/" + this.orderNum + "/status?subId=" + this.subId;
	// https://www.papajohns.com/papa-track?orderType=DELIVERY&storeId=####&orderId=####&subId=XXXX
	return this.id;
}

PapaJohns.prototype.getDetails = function() {
	var trackApiUrl = "https://papajohns-api-prod.apigee.net/api/v1/orders/" + this.orderNum + "/status?subId=" + this.subId;

	var request = new Ajax.Request(trackApiUrl, {
		method: 'get',
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

// Making: "In Progress"
// Baking: "In Oven"
// Boxing: "Ready" {"subscriptionId":"XXXX","orderId":"####","storeId":"####","orderStatus":"Ready","estimatedDeliveryTime":"2018-01-28T21:10:36.84-08:00","orderType":"D","estimatedDeliveryTimeHuman":"9:10 pm","estimatedDeliveryMinutes":29,"estimatedDeliveryTimeMin":"2018-01-28T21:05:36.840-08:00","estimatedDeliveryTimeMinHuman":"9:05 pm","estimatedDeliveryMinutesMin":24,"estimatedDeliveryTimeMax":"2018-01-28T21:15:36.840-08:00","estimatedDeliveryTimeMaxHuman":"9:15 pm","estimatedDeliveryMinutesMax":34}
// On Its Way: "Being Completed" {"driverName":"XXXX XXXX","estimatedDeliveryTime":"2018-01-28T21:10:36.84-08:00","orderId":"####","orderStatus":"Being Completed","storeId":"####","subscriptionId":"XXXX","estimatedDeliveryTimeHuman":"9:10 pm","estimatedDeliveryMinutes":16,"estimatedDeliveryTimeMin":"2018-01-28T21:05:36.840-08:00","estimatedDeliveryTimeMinHuman":"9:05 pm","estimatedDeliveryMinutesMin":11,"estimatedDeliveryTimeMax":"2018-01-28T21:15:36.840-08:00","estimatedDeliveryTimeMaxHuman":"9:15 pm","estimatedDeliveryMinutesMax":21,"orderType":"D"}
// delivered: "Completed" {"estimatedDeliveryTime":"2018-01-28T21:10:36.84-08:00","orderId":"####","orderStatus":"Completed","storeId":"####","subscriptionId":"XXXX","estimatedDeliveryTimeHuman":"9:23 pm","estimatedDeliveryMinutes":0,"estimatedDeliveryTimeMin":"2018-01-28T21:23:20.126-08:00","estimatedDeliveryTimeMinHuman":"9:23 pm","estimatedDeliveryMinutesMin":0,"estimatedDeliveryTimeMax":"2018-01-28T21:28:20.126-08:00","estimatedDeliveryTimeMaxHuman":"9:28 pm","estimatedDeliveryMinutesMax":5,"orderType":"D"}

PapaJohns.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;
	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json) {
			this.callbackStatus(-1);
			return;
	}
	var orderStatus = json.orderStatus;
	var status = 0;

	if (!orderStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		orderStatus = orderStatus.toLowerCase();
	}

	Mojo.Log.info("orderStatus: ", orderStatus);
Mojo.Log.info("JSON: ", response.responseText);
	if (orderStatus.indexOf("in progress") != -1) {
		status = 1;
	} else if (orderStatus.indexOf("in oven") != -1) {
		status = 2;
	} else if (orderStatus.indexOf("ready") != -1) {
		status = 3;
	} else if (orderStatus.indexOf("being completed") != -1) {
		status = 4;
	} else if (orderStatus.indexOf("completed") != -1) {
		status = 5;
	}
Mojo.Log.info("PapaJohns status: " + status);
	var metadata = {};
	if (json.estimatedDeliveryTimeMinHuman && json.estimatedDeliveryTimeMaxHuman) {
		metadata.delivery = json.estimatedDeliveryTimeMinHuman + " - " + json.estimatedDeliveryTimeMaxHuman;
	}
	if (json.orderType) {
		if (json.orderType == "D") {
			if (json.driverName) {
				metadata.serviceclass = "Delivery: " + json.driverName + " (Store: " + json.storeId + ")";
			} else if (status < 5) {
				metadata.serviceclass = "Delivery (Store: " + json.storeId + ")";
			}
		} else if (json.orderType == "C") {
			metadata.serviceclass = "Carryout (Store: " + json.storeId + ")";
		}
	}
Mojo.Log.info("PapaJohns delivery: " + metadata.delivery);
Mojo.Log.info("PapaJohns service: " + metadata.serviceclass);

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	var details = [];
	var dateTodayString = Mojo.Format.formatDate(new Date(), {date: "short", time: "short"});

	var orderStatusDeliveryStrs = [$L("Error"), $L("Making"), $L("Baking"), $L("Boxing"), $L("On Its Way"), $L("Delivered")];
	var orderStatusCarryoutStrs = [$L("Error"), $L("Making"), $L("Baking"), $L("Boxing"), $L("Ready"), $L("Picked Up")];

	var orderStatusStr = (json.orderType == "D") ? orderStatusDeliveryStrs[status] : orderStatusCarryoutStrs[status];

	details.push({date: dateTodayString, location: "", notes: orderStatusStr});
	/*if (status > 0) {
		var detailsVar = json.TrackPackagesResponse.packageList[0].scanEventList;
		for (var i = 0; i < detailsVar.length; i++) {
			var tmpDate = detailsVar[i].date + " " + detailsVar[i].time + " " + detailsVar[i].gmtOffset;
			Mojo.Log.info("date: ", tmpDate, " location: ", detailsVar[i].scanLocation, " notes: ", detailsVar[i].status);
			details.push({date: tmpDate, location: detailsVar[i].scanLocation, notes: detailsVar[i].status});
			if (detailsVar[i].status.toLowerCase().indexOf("delivery") != -1 && status < 4) {
				status = 4; // Hack for "Out for delivery"
			}
		}
	}*/

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone(), false, true);
	}
};

PapaJohns.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("PapaJohns Status: ", response.statusText, " Response: ", response.responseText,
				  " Headers: ", Object.toJSON(response.headerJSON),
				  " Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error."));
};

registerService("Papa John's", new PapaJohns());
