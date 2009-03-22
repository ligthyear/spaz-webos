function FavoritesAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	scene_helpers.addCommonSceneMethods(this);
}

FavoritesAssistant.prototype.setup = function() {

	this.scroller = this.controller.getSceneScroller();
	this.initAppMenu();
	this.initTwit();


	this.setupCommonMenus({
		viewMenuItems: [
			{
				items: [
					{label: "Favorites", command:'scroll-top'}
				]
			},
			{
				items: [
					{label:$L('Compose'),  icon:'compose', command:'compose', shortcut:'N'},
					{label:$L('Update'),   icon:'sync', command:'refresh', shortcut:'R'}					
				]
			}
			
		],
		cmdMenuItems: [{ items:
			[
				{},
				// {label:$L('Home'),        iconPath:'images/theme/menu-icon-home.png', command:'home', shortcut:'H'},
				{label:$L('My Timeline'), icon:'conversation', command:'my-timeline', shortcut:'T'},
				{label:$L('Favorites'), iconPath:'images/theme/menu-icon-favorite.png', command:'favorites', shortcut:'F', disabled:true},
				{label:$L('Search'),      icon:'search', command:'search', shortcut:'S'},
				// {label:$L('Followers'),   icon:'remove-vip', command:'followers', shortcut:'L'},
				{}
			]
		}]
	});
	
	/* this function is for setup tasks that have to happen when the scene is first created */
		
	/* use Luna.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	
	/* add event handlers to listen to events from widgets */
}

FavoritesAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
	
	this.addPostPopup();


	var thisA = this; // for closures below
	
	jQuery().bind('new_favorites_timeline_data', function(e, tweets) {
		
		/*
			Check to see if the returned query matches what we are using. If not, ignore.
		*/

		/*
			reverse the tweets for collection rendering (faster)
		*/
		var rendertweets = tweets;

		jQuery.each( rendertweets, function() {
			this.text = makeItemsClickable(this.text);
			
			// var itemhtml = Mojo.View.render({object: this, template: 'search-twitter/search-item'});
			var itemhtml = sc.app.tpl.parseTemplate('tweet', this);
			
			/*
				make jQuery obj
			*/
			var jqitem = jQuery(itemhtml);
			
			/*
				attach data object to item html
			*/
			jqitem.data('item', this);
			
			/*
				put item on timeline
			*/
			jQuery('#favorites-timeline').prepend(jqitem);
		});


		/*
			Update relative dates
		*/
		sch.updateRelativeTimes('#favorites-timeline>div.timeline-entry>.status>.meta>.date', 'data-created_at');
		// e.data.thisAssistant.spinnerOff();
		thisA.hideInlineSpinner('#favorites-timeline');
		
	});
	
	/*
		listen for clicks on user avatars
	*/
	jQuery('div.timeline-entry>.user', this.scroller).live(Mojo.Event.tap, function(e) {
		var userid = jQuery(this).attr('data-user-screen_name');
		Mojo.Controller.stageController.pushScene('user-detail', userid);
	});
	
	jQuery('.username.clickable', this.scroller).live(Mojo.Event.tap, function(e) {
		var userid = jQuery(this).attr('data-user-screen_name');
		Mojo.Controller.stageController.pushScene('user-detail', userid);
	});

	jQuery('.hashtag.clickable', this.scroller).live(Mojo.Event.tap, function(e) {
		var hashtag = jQuery(this).attr('data-hashtag');
		thisA.searchFor('#'+hashtag);
	});

	jQuery('div.timeline-entry>.status>.meta', this.scroller).live(Mojo.Event.tap, function(e) {
		var statusid = jQuery(this).attr('data-status-id');
		Mojo.Controller.stageController.pushScene('message-detail', statusid);
	});
	
	jQuery('#search-twitter-textfield', this.scroller).bind('focus', function(e) {
		jQuery('#submit-search-button').fadeIn('fast');
	});

	jQuery('#search-twitter-textfield', this.scroller).bind('blur', function(e) {
		jQuery('#submit-search-button').fadeOut('fast');
	});
	
	
	jQuery().bind('search_twitter_refresh', { thisAssistant:this }, function(e) {
		e.data.thisAssistant.startRefresher();
	});
	
	
	this.refresh();

	
}


FavoritesAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

FavoritesAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}



FavoritesAssistant.prototype.refresh = function(event) {
	this.getData();
}

FavoritesAssistant.prototype.getData = function() {
	sc.helpers.markAllAsRead('#favorites-timeline>div.timeline-entry');
	this.showInlineSpinner('#favorites-timeline', 'Loading favorite tweets…');
	
	this.twit.getFavorites();
};