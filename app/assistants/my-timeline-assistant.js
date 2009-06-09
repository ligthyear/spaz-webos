/**
 * events raised here:
 * 'my_timeline_refresh' 
 */


function MyTimelineAssistant(argFromPusher) {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	scene_helpers.addCommonSceneMethods(this);
	
	if (argFromPusher && argFromPusher.firstload === true) {
		// console.debug();
		// this.clearTimelineCache();
	}
	
	
	/*
		this property will hold the setInterval return
	*/
	this.refresher = null;
	

	this.cacheVersion = 1;  // we increment this when we change how the cache works
	
	
	this.cacheDepot = new Mojo.Depot({
		name:'SpazDepotTimelineCache',
		displayName:'SpazDepotTimelineCache',
		replace:false,
		version:1
	});

}



MyTimelineAssistant.prototype.setup = function() {
	
	var thisA = this;
	
	this.tweetsModel = [];

	
	/* this function is for setup tasks that have to happen when the scene is first created */

	this.initAppMenu({ 'items':loggedin_appmenu_items });

	this.initTwit();
	
	/*
		this will set the state for this.isFullScreen
	*/
	this.trackStageActiveState();
	

	this.setupCommonMenus({
		viewMenuItems: [
			{},
			// {label: $L('Location'), command:'update-location' },
			{label: $L('Filter timeline'), iconPath:'images/theme/menu-icon-triangle-down.png', submenu:'filter-menu'}
		],
		cmdMenuItems: [
			{label:$L('Compose'),  icon:'compose', command:'compose', shortcut:'N'},
			{
				/*
					So we don't get the hard-to-see disabled look on the selected button,
					we make the current toggle command "IGNORE", which will not trigger an action
				*/
				toggleCmd:'IGNORE',
				items: [
					{label:$L('My Timeline'), icon:'conversation', command:'IGNORE', shortcut:'T', 'class':"palm-header left"},
					{label:$L('Favorites'), iconPath:'images/theme/menu-icon-favorite.png', command:'favorites', shortcut:'F'},
					{label:$L('Search'),      icon:'search', command:'search', shortcut:'S'},
				]
			},
			{label: $L('Refresh'),   icon:'sync', command:'refresh', shortcut:'R'}
			
		]
	});

	this.scroller = this.controller.getSceneScroller();



	
	this.setupInlineSpinner('activity-spinner-my-timeline');
	
	
	/* setup widgets here */
	
	jQuery().bind('load_from_mytimeline_cache_done', function() {
		if (thisA.activateStarted === true) {
			dump('getting data!');
			thisA.getData();
		} else {
			dump('waiting for activate to load!');
			thisA.loadOnActivate = true;
		}
	});

	this.loadTimelineCacheOnActivate = true;
	
}



MyTimelineAssistant.prototype.activate = function(event) {

	var thisA = this; // for closures

	/* add event handlers to listen to events from widgets */

	
	if (this.loadTimelineCacheOnActivate === true) {
		dump('Loading Timeline Cache ###################################');
		this.loadTimelineCache();
		this.loadTimelineCacheOnActivate = false;
	}


	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
	this.activateStarted = true;
	
	// this.addPostPopup();

	

	
	
	jQuery('#my-timeline-username').text(sc.app.username);
	
	
	/*
		Listen for error
	*/
	jQuery().bind('error_combined_timeline_data', { thisAssistant:this }, function(e, error_array) {
		dump('error_combined_timeline_data - response:');
		dump(error_array);
		thisA.hideInlineSpinner('activity-spinner-my-timeline');
		thisA.startRefresher();

		var err_msg = $L("There were errors retrieving your combined timeline");
		thisA.displayErrorInfo(err_msg, error_array);
	});
	


	/*
		Get combined timeline data
	*/
	jQuery().bind('new_combined_timeline_data', { thisAssistant:this }, function(e, tweets, render_callback) {
		
		e.data.thisAssistant.renderTweets.call(e.data.thisAssistant, tweets, render_callback, false);

	});

	
	jQuery().bind('my_timeline_refresh', { thisAssistant:this }, function(e) {
		e.data.thisAssistant.refresh();
	});
	
	
	jQuery('#my-timeline div.timeline-entry', this.scroller).live(Mojo.Event.tap, function(e) {
		var jqtarget = jQuery(e.target);

		e.stopImmediatePropagation();
		
		if (jqtarget.is('div.timeline-entry>.user') || jqtarget.is('div.timeline-entry>.user img')) {
			var userid = jQuery(this).attr('data-user-screen_name');
			Mojo.Controller.stageController.pushScene('user-detail', userid);
			return;
			
		} else if (jqtarget.is('.username.clickable')) {
			var userid = jqtarget.attr('data-user-screen_name');
			Mojo.Controller.stageController.pushScene('user-detail', userid);
			return;
			
		} else if (jqtarget.is('.hashtag.clickable')) {
			var hashtag = jqtarget.attr('data-hashtag');
			thisA.searchFor('#'+hashtag);
			return;
			
		} else if (jqtarget.is('div.timeline-entry .meta')) {
			var status_id = jqtarget.attr('data-status-id');
			var isdm = false;
			var status_obj = null;

			status_obj = thisA.getTweetFromModel(parseInt(status_id));

			if (jqtarget.parent().parent().hasClass('dm')) {
				isdm = true;
			}

			Mojo.Controller.stageController.pushScene('message-detail', {'status_id':status_id, 'isdm':isdm, 'status_obj':status_obj});
			return;
			
		} else if (jqtarget.is('div.timeline-entry a[href]')) {
			return;

		} else {
			var status_id = jQuery(this).attr('data-status-id');
			var isdm = false;
			var status_obj = null;

			if (jQuery(this).hasClass('dm')) {
				isdm = true;
			}
			Mojo.Controller.stageController.pushScene('message-detail', {'status_id':status_id, 'isdm':isdm, 'status_obj':status_obj});
			return;
		}
	});
	



	if (this.loadOnActivate) {
		/*
			Make request to Twitter
		*/
		this.getData();

		this.startRefresher();
		
		/*
			Disable this so we don't load on next activation
		*/
		this.loadOnActivate = false;
	}
	
}


MyTimelineAssistant.prototype.deactivate = function(event) {
	
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
	
	// this.removePostPopup();
	
	jQuery().unbind('error_user_timeline_data');
	jQuery().unbind('new_combined_timeline_data');
	jQuery().unbind('update_succeeded');
	jQuery().unbind('update_failed');
	jQuery().unbind('my_timeline_refresh');
	
	
	// jQuery('div.timeline-entry>.user', this.scroller).die(Mojo.Event.tap);
	// jQuery('.username.clickable', this.scroller).die(Mojo.Event.tap);
	// jQuery('.hashtag.clickable', this.scroller).die(Mojo.Event.tap);
	// jQuery('div.timeline-entry .meta', this.scroller).die(Mojo.Event.tap);
	// jQuery('div.timeline-entry a[href]', this.scroller).die(Mojo.Event.tap);
	jQuery('#my-timeline div.timeline-entry', this.scroller).die(Mojo.Event.tap);
	
	
	
}

MyTimelineAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
	
	jQuery().unbind('load_from_mytimeline_cache_done');

	this.stopTrackingStageActiveState();
	
	this.stopRefresher();
}


MyTimelineAssistant.prototype.loadTimelineCache = function() {

	var thisA = this;
	
	this.showInlineSpinner('activity-spinner-my-timeline', 'Loading cached tweets…', true);

	this.cacheDepot.simpleGet(sc.app.username,
		function(data) {
			dump('loading cache');
			
			if (!data || !data.version || (data.version < thisA.cacheVersion)) {
				dump('Cache version out of date (or empty), not loading');
				jQuery().trigger('load_from_mytimeline_cache_done');
				return;
			}
			
			var tl_data = null;
			
			try {
				dump(data);
				thisA.twit.setLastId(SPAZCORE_SECTION_FRIENDS, data[SPAZCORE_SECTION_FRIENDS + '_lastid']);
				thisA.twit.setLastId(SPAZCORE_SECTION_REPLIES, data[SPAZCORE_SECTION_REPLIES + '_lastid']);
				thisA.twit.setLastId(SPAZCORE_SECTION_DMS,     data[SPAZCORE_SECTION_DMS     + '_lastid']);
	
				/*
					it seems to be double-encoded coming from the depot
				*/				
				tl_data = sch.deJSON(data.tweets_json);
				if (tl_data === null) {
					throw new SyntaxError("JSON from cache could not be decoded");
				} 
				if (sch.isString(tl_data)) { // in webkit we're sometimes double-encoded. Dunno why
					tl_data = sch.deJSON(tl_data);	
				}			
			} catch (e) {
				dump('Couldn\'t load cache');
				dump(e.name + ":" + e.message);
				jQuery().trigger('load_from_mytimeline_cache_done');
			}
			
			if (tl_data) {
				dump('My Timeline Cache loaded ##########################################');
				dump(tl_data);
				thisA.renderTweets(tl_data,
					function() {
						document.getElementById('my-timeline').innerHTML = data.tweets_html;
						sch.markAllAsRead('#my-timeline>div.timeline-entry');
					},
					true // we are loading from cache
				);
			}
		},
		function(msg) {
			dump('My Timeline Cache load failed:'+msg);
			jQuery().trigger('load_from_mytimeline_cache_done');
		}
	);
	
};

MyTimelineAssistant.prototype.saveTimelineCache = function() {
	
	var tweetsModel_html = document.getElementById('my-timeline').innerHTML;
	var tweetsModel_json = sch.enJSON(this.tweetsModel);
	
	
	var twitdata = {};
	twitdata['version']                            = this.cacheVersion || -1;
	twitdata['tweets_json']                        = tweetsModel_json;
	twitdata['tweets_html']                        = tweetsModel_html;
	twitdata[SPAZCORE_SECTION_FRIENDS + '_lastid'] = this.twit.getLastId(SPAZCORE_SECTION_FRIENDS);
	twitdata[SPAZCORE_SECTION_REPLIES + '_lastid'] = this.twit.getLastId(SPAZCORE_SECTION_REPLIES);
	twitdata[SPAZCORE_SECTION_DMS     + '_lastid'] = this.twit.getLastId(SPAZCORE_SECTION_DMS);
	
	
	this.cacheDepot.simpleAdd(sc.app.username, twitdata,
		function() { dump('My Timeline Cache Saved') },
		function(msg) { dump('My Timeline Cache save failed:'+msg) }
	);
	
};



MyTimelineAssistant.prototype.getEntryElementByStatusId = function(id) {
	
	var el = jQuery('#my-timeline div.timeline-entry[data-status-id='+id+']', this.scroller).get(0);
	
	return el;
	
};




MyTimelineAssistant.prototype.getData = function() {
	sch.markAllAsRead('#my-timeline>div.timeline-entry');
	this.showInlineSpinner('activity-spinner-my-timeline', 'Looking for new tweets…');
	
	/*
		friends_count is the only one that gets used currently
	*/
	this.twit.getCombinedTimeline({
		'friends_count':sc.app.prefs.get('timeline-friends-getcount'),
		'replies_count':sc.app.prefs.get('timeline-replies-getcount'),
		'dm_count':sc.app.prefs.get('timeline-dm-getcount')
	});
};


MyTimelineAssistant.prototype.refresh = function(e) {
	this.stopRefresher();
	this.getData();
};



MyTimelineAssistant.prototype.renderTweets = function(tweets, render_callback, from_cache) {
	
	if (from_cache !== true) {
		from_cache = false;
	}
	
		
	var thisA = this;
	
	/*
		If there are new tweets, process them
	*/
	// if (tweets && tweets.length>0) {
	if (tweets && tweets.length>0) {

		var rendertweets = tweets;
		
		var tweets_added = 0;
		
		Mojo.Timing.get('my_timeline_render');
		Mojo.Timing.resume('my_timeline_render');
		
		time.start('my_timeline_render');
		
		jQuery.each( rendertweets, function() {
			/*
				check to see if this item exists
			*/
			if (this == false) {
				dump("Tweet object was FALSE; skipping");
			} else if (!thisA.getEntryElementByStatusId(this.id)) {
				time.start('render-one');
				dump('adding '+this.id);
				
				/*
					add to tweetsModel
				*/
				thisA.addTweetToModel(this);
				tweets_added++;
				
				/*
					skip rendering if we are loading from cache, as per new
					approach of storing HTML timeline as well.
				*/
				
				if (!from_cache) {

					time.start('makeItemsClickable');
					this.text = makeItemsClickable(this.text);
					time.stop('makeItemsClickable');

					if (from_cache) {
						this.not_new = true;
					}

					/*
						Render the tweet
					*/
					time.start('render_tweet');
					if (this.SC_is_dm) {
						var itemhtml = sc.app.tpl.parseTemplate('dm', this);
					} else {
						var itemhtml = sc.app.tpl.parseTemplate('tweet', this);
					}
					time.stop('render_tweet');

					/*
						make jQuery obj
					*/
					time.start('makeJQitem');
					// var jqitem = jQuery(itemhtml);

					// if (!from_cache) {
					// 	jqitem.addClass('new');
					// }

					// if (this.SC_is_reply) {
					// 	jqitem.addClass('reply');
					// }

					// if (this.SC_is_dm) {
					// 	jqitem.addClass('dm');
					// }
					time.stop('makeJQitem');

					time.start('sc.app.Tweets.save');
					sc.app.Tweets.save(this);
					time.stop('sc.app.Tweets.save');
					/*
						put item on timeline
					*/
					time.start('prepend');
					var tlel = document.getElementById('my-timeline');
					jQuery('#my-timeline').prepend(itemhtml);
					time.stop('prepend');
				}
				time.stop('render-one');
			} else {
				dump('Tweet ('+this.id+') already is in timeline');
			}

			
		});

		time.stop('my_timeline_render');
		time.setReportMethod(function(l) {
			Mojo.Log.info("TIMER====================\n" + l.join("\n"))
		});
		time.setLineReportMethod(function(l) {
			Mojo.Log.info(l)
		});

		time.report();
		
		Mojo.Timing.pause('my_timeline_render');
		Mojo.Log.info(Mojo.Timing.reportTiming("my_timeline_render", "my_timeline_render -- \n"));
		
		dump("tweets_added:"+tweets_added);
		dump("from_cache:"+from_cache);
		dump("sc.app.prefs.get('timeline-scrollonupdate'):"+sc.app.prefs.get('timeline-scrollonupdate'));
		
		
		var num_entries = jQuery('#my-timeline div.timeline-entry').length;
		dump("num_entries:"+num_entries);
		var old_entries = num_entries - tweets_added;
		dump("old_entries:"+old_entries);
		if ( tweets_added > 0 && old_entries > 0 && !from_cache && sc.app.prefs.get('timeline-scrollonupdate') ) {
			dump("I'm going to scroll to new in 500ms!");
			setTimeout(function() { thisA.scrollToNew() }, 500);
		} else {
			dump("Not scrolling to new!");
		}
		
		
	} else {
		dump("no new tweets");
	}
	
	/*
		remove extra items
	*/
	thisA.removeExtraItems();

	/*
		Update relative dates
	*/
	sch.updateRelativeTimes('div.timeline-entry .meta>.date', 'data-created_at');
	
	/*
		re-apply filtering
	*/
	thisA.filterTimeline();
	
	/*
		we are done rendering, so call the optional callback
	*/
	if (render_callback) {
		dump('Calling render_callback #################################');
		render_callback();
	}
	
	var new_count = jQuery('#my-timeline>div.timeline-entry.new:visible').length;
	
	// alert("new_count:"+new_count);
	// alert("fullscreen"+thisA.isFullScreen);
	
	if (!from_cache && new_count > 0 && !thisA.isFullScreen) {
		thisA.newMsgBanner(new_count);
		thisA.playAudioCue('newmsg');		
	} else if (thisA.isFullScreen) {
		dump("I am not showing a banner! in "+thisA.controller.sceneElement.id);
	}
	

	// thisA.hideInlineSpinner('#my-timeline-spinner-container');
	thisA.startRefresher();
	
	/*
		Save this in case we need to load from cache
	*/
	if (!from_cache) {
		thisA.hideInlineSpinner('activity-spinner-my-timeline');
		thisA.saveTimelineCache();
	} else {
		thisA.clearInlineSpinner('activity-spinner-my-timeline');
		jQuery().trigger('load_from_mytimeline_cache_done');
	}
	


};



MyTimelineAssistant.prototype.startRefresher = function() {
	dump('Starting refresher');
	/*
		Set up refresher
	*/
	this.stopRefresher(); // in case one is already running
	
	var time = sc.app.prefs.get('network-refreshinterval');
	
	if (time > 0) {
		this.refresher = setInterval(function() {
				jQuery().trigger('my_timeline_refresh');
			}, time
		)
	} else {
		this.refresher = null;
	}
};

MyTimelineAssistant.prototype.stopRefresher = function() {
	dump('Stopping refresher');
	/*
		Clear refresher
	*/
	clearInterval(this.refresher);
};


/**
 * Gets tweet from this.tweetsModel, or false if DNE 
 */
MyTimelineAssistant.prototype.getTweetFromModel = function(id) {
	
	for(var i=0; i < this.tweetsModel.length; i++) {
		if (this.tweetsModel[i].id == id) {
			return this.tweetsModel[i];
		}
	}
	
	return false;
};



/*
	add to tweetsModel
*/
MyTimelineAssistant.prototype.addTweetToModel = function(twobj) {
	var newlen = this.tweetsModel.push(twobj);
	dump('this.tweetsModel is now '+newlen+' items long');
};


MyTimelineAssistant.prototype.removeExtraItems = function() {
	/*
		from html timeline
	*/
	sch.removeExtraElements('#my-timeline>div.timeline-entry:not(.reply):not(.dm)', sc.app.prefs.get('timeline-maxentries'));
	sch.removeExtraElements('#my-timeline>div.timeline-entry.reply', sc.app.prefs.get('timeline-maxentries-reply'));
	sch.removeExtraElements('#my-timeline>div.timeline-entry.dm', sc.app.prefs.get('timeline-maxentries-dm'));
	
	/*
		now sync the local model to the html
		We go backwards because we're splicing
	*/
	var thisA = this;
	var new_model = [];
	// Mojo.Timing.resume('syncModel');
	jQuery('#my-timeline>div.timeline-entry').each( function() {
		var id = jQuery(this).attr('data-status-id');
		var this_obj = thisA.getTweetFromModel(id);
		new_model.push(this_obj);
	} );
	this.tweetsModel = new_model.reverse();
	
	// Mojo.Timing.pause('syncModel');
	// alert(Mojo.Timing.reportTiming("syncModel", "syncModel Timing -- \n"));

	
	
	
	
	
	// for (var i=this.tweetsModel.length-1; i >=0; i--) {
	// 	var this_item = this.tweetsModel[i];
	// 	if (!this.getEntryElementByStatusId(this_item.id)) {
	// 		var deleted = this.tweetsModel.splice(i, 1)[0];
	// 		dump("deleted entry "+this_item.id+" in model");
	// 		dump(deleted);
	// 	} else {
	// 		dump("keeping "+this_item.id);
	// 		dump(this_item);
	// 	}
	// 	
	// }
	
	var html_count  = jQuery('#my-timeline>div.timeline-entry').length;
	var norm_count  = jQuery('#my-timeline>div.timeline-entry:not(.reply):not(.dm)').length;
	var reply_count = jQuery('#my-timeline>div.timeline-entry.reply').length;
	var dm_count    = jQuery('#my-timeline>div.timeline-entry.dm').length;
	
	
	var model_count = this.tweetsModel.length;
	
	dump('HTML COUNT:'+html_count);
	dump('NORM COUNT:'+norm_count);
	dump('REPLY COUNT:'+reply_count);
	dump('DM COUNT:'+dm_count);
	dump('MODEL COUNT:'+model_count);
	
	// var last_normal = jQuery('#my-timeline>div.timeline-entry:not(.reply):not(.dm):last');
	// var last_normal = jQuery('#my-timeline>div.timeline-entry:not(.reply):not(.dm):last');
	// 
	// 
	// 
	// function removeFromModel(tweet_array, key, value) {
	// 	var matching_tweets
	// 	
	// 	for (var i=0; i < tweet_array.length; i++) {
	// 		
	// 		if (tweet_array[i][key] == value) {
	// 			
	// 		}
	// 		
	// 	}
	// }
	// 
	
	
};
