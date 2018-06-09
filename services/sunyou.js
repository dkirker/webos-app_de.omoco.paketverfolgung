function SunYou() {
}

SunYou.prototype.getAuthor = function() {
	return "Donald Kirker";
}

SunYou.prototype.getVersion = function() {
	return "1.0.0";
}

SunYou.prototype.getColor = function() {
	return "#073D99";
}

SunYou.prototype.init = function(id, callbackStatus, callbackDetails, callbackMetadata, callbackError) {
	this.id = id;
	this.callbackStatus = callbackStatus;
	this.callbackDetails = callbackDetails;
	this.callbackMetadata = callbackMetadata;
	this.callbackError = callbackError;
};

SunYou.prototype.getTrackingUrl = function() {
	var locale = "en_US";
	if(LANG == "de")
		locale = "de_DE";
	return "http://www.sypost.net/search?orderNo=" + this.id;
}

SunYou.prototype.getDetails = function() {
	var request = new Ajax.Request("http://www.sypost.net/query", {
		method: 'post',
		contentType: "application/x-www-form-urlencoded",
		postBody: "connotNo=" + this.id,
		evalJS: 'false',
		evalJSON: 'true',
		onSuccess: this.getDetailsRequestSuccess.bind(this),
		onFailure: this.getDetailsRequestFailure.bind(this)
	});
};

SunYou.prototype.getDetailsRequestSuccess = function(response) {
	var json = response.responseJSON;

Mojo.Log.info("SunYou tracking " + this.id);
	if (!json && response.responseText) {
		json = Mojo.parseJSON(response.responseText);
	}
	if (!json || json.rtnCode != 0 ||
		!json.data || !json.data[0]) {
			this.callbackStatus(-1);
			return;
	}
	var keyStatus = json.data[0].lastContent;
	var status = 0;

	if (!keyStatus) {
		this.callbackStatus(-1);
		return;
	} else {
		keyStatus = keyStatus.toLowerCase();
	}

	Mojo.Log.info("SunYou keyStatus: ", keyStatus);
Mojo.Log.info("SunYou JSON: ", response.responseText);
	if (keyStatus.indexOf("pre alert") != -1) {
		status = 1;
	} else if (keyStatus.indexOf("acceptance") != -1) {
		status = 2;
	} else if (keyStatus.indexOf("departed") != -1 || keyStatus.indexOf("arrived") != -1) {
		status = 3;
	} else if (keyStatus.indexOf("delivery") != -1 || keyStatus.indexOf("exception") != -1) { // Exceptions can happen anywhere, and this shouldn't be indicitive of "out for delivery"
		status = 4;
	} else if (keyStatus.indexOf("delivered") != -1) {
		status = 5;
	}
Mojo.Log.info("SunYou status: " + status);

	var metadata = {};
	/*if () {
		metadata.delivery = ;
	}*/
Mojo.Log.info("SunYou delivery by: " +  metadata.delivery);
	/*if () {
		metadata.serviceclass = ;
	}*/
Mojo.Log.info("SunYou serviceClass: " + metadata.serviceclass);

	if (metadata != {}) {
		this.callbackMetadata(metadata);
	}

	var details = [];
	if (status > 0) {
		if (json.data[0].result && json.data[0].result.origin && json.data[0].result.origin.items) {
			var detailsVar = json.data[0].result.origin.items;

Mojo.Log.info("SunYou scans: " + detailsVar.length);
			for (var i = 0; i < detailsVar.length; i++) {
				var detail = detailsVar[i];
				var tmpDate = Mojo.Format.formatDate(new Date(detail.createTime), {date: "short", time: "short"});
				var contentParts = detail.content.split(",");
				var tmpLocation = "";
				var tmpNotes = "";

				if (contentParts.length == 1) { // "Pre Alert to UNITED STATES"
					tmpNotes = contentParts[0];
				} else if (contentParts.length == 2) { // "GMTC, Arrived in transit country"
					tmpLocation = contentParts[0];
					tmpNotes = contentParts[1].trim();
				} else if (contentParts.length > 2) { // "CHINA, SHENZHEN, Departed Sunyou Facility" or "CHINA, SHENZHEN, Acceptance, Sent to UNITED STATES"
					tmpLocation = contentParts[1] + ", " + contentParts[0];
					for (var j = 2; j < contentParts.length; j++) {
						if (j > 2) {
							tmpNotes += ",";
						}
						tmpNotes += contentParts[j];
					}
				}

				Mojo.Log.info("SunYou date: ", tmpDate, " location: ", tmpLocation, " notes: ", tmpNotes);
				details.push({date: tmpDate, location: tmpLocation, notes: tmpNotes});
			}
		}
	}

	this.callbackStatus(status);

	if (details.length > 0) {
		this.callbackDetails(details.clone());
	}
};

SunYou.prototype.getDetailsRequestFailure = function(response) {
	Mojo.Log.info("SunYou Status: ", response.statusText, " Response: ", response.responseText, " Headers: ", Object.toJSON(response.headerJSON), "Response JSON: ", Object.toJSON(response.responseJSON));

	this.callbackError($L("There was an error")/*"Konnte Seite nicht laden."*/);
};

registerService("SunYou", new SunYou());
