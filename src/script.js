/**
 * Copyright David Shumway 2020
 * License: GPLv3
 * Contact: dshumw2@uic.edu
 *
 * Round-robin scheduling.
 * https://stackoverflow.com/questions/6648512/
 * 		scheduling-algorithm-for-a-round-robin-tournament
 *
 * Notes:
 *  - For debugging purposes, you can mimic breakout rooms functionality
 * 		on a "basic" account by enabling
 *      `MeetingConfig.meetingOptions.isEnableBreakoutRoom = true'
 * 		in the browser console.
 *
 * TODO: If browser window reloads, then list of pairings will be
 * 		forgotten. Can solve by keeping pairings in the browser or
 * 		extension cache.
 */

//~ console.log('Zoomie', window.location.href);

/**
 * Global variables
 */
var log = 'Zoomie extension::';
var pairings = {},
	tmpPairings = {}; // tmpPairings will be a copy of pairings
var au = [], // Assignable users
	ab = [], // Assign buttons
	userDict = {}, // Always updates to match au. {'name': {'name': <str>, 'index': <#>}}
	numPairings = 0,
	tmpNumPairings = 0,
	ignoredUsers = {}, // E.g., 1+ co-hosts not to place in rooms.
	primaryCohost = '',
	elements = {
		userIgnoreSelect: null,
		userIgnoreSelectAccept: null,
		userIgnoreSelectTitle: null,
		autoButton: null,
	},
	breakoutRoomHeight = 0,
	generatedPairs = false,
	breakoutWindowOpen = false, // Tracks breakout dialog state (open/closed)
	breakoutRoomsShowing = false // Track state
; 

/**
 * Initialize the program.
 */
function load() {
	// Add css styles
	add_styles()
	
	// Zoomie history pairings.
	// Not required as of now.
	if (!localStorage['zoomie-history']) {
		// Create new entry. An empty dict.
		//~ localStorage['zoomie-history'] = '{}';
	} else {
		//~ var newMtg = confirm('"ZOOMIE": Would you like to load any pairings from the previous session?');
		//~ if (newMtg) {
			//~ // Yes. Load it.
			//~ // E.g. user reloaded page.
			//~ try {
				//~ pairings = JSON.parse(localStorage['zoomie-history']);
				//~ tmpPairings = JSON.parse(localStorage['zoomie-history']);
			//~ } catch (e) {
				//~ alert('Could not parse last session:',e.message);
			//~ }
		//~ } else {
			//~ // No. Don't load it.
			//~ // Reset pairings object in storage.
			//~ localStorage['zoomie-history'] = '{}';
		//~ }
	}
	// Saved - time to close
	// Saved setting for auto-close time
	if (!localStorage['zoomie-closeTime']) {
		localStorage['zoomie-closeTime'] = 60;
	}
	// Saved - round number
	if (!localStorage['zoomie-roundNumber']) {
		localStorage['zoomie-roundNumber'] = 1;
	}
	
	// If less than 2 seconds, then zoom.us overwrites getBreakoutButton().
	//setTimeout(getBreakoutButton, 2000);
}

/**
 * Add CSS styles
 */
function add_styles() {
	GM_addStyle(
		'.zoomie-ignoreContainer {'+
		'width:100%;'+
		'z-index:1002;'+
		'position:absolute;'+
		'display:none;'+
		'}'
		);
	GM_addStyle(
		'.zoomie-ignoreUsersTitle {'+
		'width:100%;'+
		'height:40px;'+
		'background-color: aliceblue;'+
		'padding:10px;'+
		'z-index:1002;'+
		//~ 'position:absolute;'+
		'display:none;'+
		'text-align:center;'+
		'font-size:18px;'+
		'font-weight:bold;}'
		);
	GM_addStyle('.zoomie-show {display: block !important;}');
	GM_addStyle('.zoomie-hide {display: none !important;}');
	GM_addStyle('.ignoreLegend {float: left; width: 26%; height: 50px; text-align: left; padding: 2px; text-decoration: underline;}');
	GM_addStyle('.ignoreListOdd {background-color: #cfcfcf}');
	GM_addStyle('.ignoreListEven {background-color: #efefef}');
	GM_addStyle('.zoomieRadio1 {cursor: pointer; zoom: 1.2; width: 8%;}');
	// try matching padding of legends
	GM_addStyle('.zoomieRadio2 {cursor: pointer; zoom: 1.2; width: 8%; margin-right: 10px !important;}');
	// 60px + 10px + 10px = 80px
	GM_addStyle('.zoomieSeconds {background-color: #efefef; border-bottom: 1px solid blue; cursor: pointer; width: 100%; height: 48px; padding: 6px;}');
	GM_addStyle('.zoomieSecondsInput {cursor: pointer; width: 60px; zoom: 1.2; border-radius: 8px; padding-left: 4px; text-align: center;}');
	
	// Overwrites to zoom styles
	
	GM_addStyle('.common-window {border: 0 !important; box-shadow: none !important; -webkit-box-shadow: none !important;}'); 
	GM_addStyle('.ReactModal__Content {transform: none !important; top: 4% !important; left: 0 !important;}');
	GM_addStyle('.ReactModal__Content--after-open {transform: none !important; top: 4% !important; left: 0 !important;}');
	GM_addStyle('#boRoomMgmtWindow {width: 98% !important; position: fixed !important; margin-left: 1%;}');
}

//~ /**
 //~ * Wait for "Breakout Rooms" button to appear, then attach an event to it.
 //~ */
//~ function getBreakoutButton() {
	//~ //
//~ }

// Set an interval to watch for createRoomWindow element to appear.
// Once it appears, then add the Zoomie button.
// Then, set another interval to check when the createRoomWindow
// disappears.
var x = setInterval(function() {
	//~ console.log('--',window.location.href);
	//~ if (window.location.href.indexOf('pwa') != -1) {
		//~ alert('x');
		//~ clearInterval(x);
	//~ }
	//console.log('xx',window.frames);
	//~ console.log(document.body.innerHTML, document);
	//~ clearInterval(x);
	// Breakout window popup
	//~ var x = document.getElementById('createRoomWindow');
	var x = document.getElementById('boRoomMgmtWindow');
	
	//~ console.log(x);
	if (x && !breakoutWindowOpen) {
		// Attach the Zoomie button.
		console.log(log + 'Breakout window opened');
		breakoutWindowOpen = true;
		setTimeout(attachBreakoutContainer, 200);
	} else if (!x && breakoutWindowOpen) {
		// Reset the breakoutWindowOpen boolean.
		breakoutWindowOpen = false;
	}
	
	// "Recreate" button popup
	var x = document.getElementsByClassName('recreate-paper__footer');
	if (x && x.length == 1 && !x[0].zoomie_mark) {
		x.zoomie_mark = 1;
		x[0].onclick = attachBreakoutContainer;
	}
}, 100);


/**
 * Retrieve breakout room dialog box height.
 */
window.onresize = function() {
	getBreakoutRoomHeight();
}
function getBreakoutRoomHeight() {
	var x = document.getElementsByClassName('bo-mgmtwindow-content');
	if (x && x[0] && x[0].style) {
		breakoutRoomHeight = parseInt(
			x[0].style.height.replace('px','')
		);
	}
	if (elements.userIgnoreSelect) {
		//~ elements.userIgnoreSelect.style.height = (breakoutRoomHeight-80) + 'px';
		//~ elements.userIgnoreSelectAccept.style.marginTop = (breakoutRoomHeight-80) + 'px';
	}
}

/**
 * 
 */
function detachSettings() {
	elements.ignoreContainer.parentNode.removeChild(elements.ignoreContainer);
}

/**
 * Attach the settings elements to the dialog box.
 */
function attachSettings() {
	
	////////////////////////////////////////////////////////////////
	// Dialog container
	////////////////////////////////////////////////////////////////
	var a = document.getElementById('boRoomMgmtWindow');
	
	// Container for "-Auto-" button dialog
	var z = document.createElement('div');
	z.className = 'zoomie-ignoreContainer';
	a.insertBefore(z, a.firstChild);
	elements.ignoreContainer = z;
	
	// Ignore users title bar
	var z = document.createElement('div');
	z.className = 'zoomie-ignoreUsersTitle';
	z.innerText = 'Zoomie';
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectTitle = z;
	
	//////////////////////////////////////////
	// Ignore users main container
	//////////////////////////////////////////
	var z = document.createElement('div');
	z.setAttribute('style', 'width:100%;z-index:1002;display:none;background-color:#eee;overflow:auto;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelect = z;
	if (au.length) {
		z.innerHTML = // These are 50px tall. 12% + 26% + 60% = 98%
			'<div class="ignoreLegend" style="width: 8% !important;overflow:hidden;">Ignore</div>'+
			'<div class="ignoreLegend" style="width: 8% !important;overflow:hidden;">Co-host</div>'+
			'<div class="ignoreLegend" style="width: 16% !important;overflow:hidden;">Participant</div>'+
			'<div class="ignoreLegend" style="width: 66% !important;overflow:hidden;">Partners</div>'+
			'<br style="clear:both" />'; 
	}
		
	// Ignore users div to contain
	var z = document.createElement('div');
	z.setAttribute('style', 'width:100%;height:400px;z-index:1004;display:none;background-color:#eee;overflow:auto;border-bottom:1px solid blue;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectList = z;
	
	//////////////////////////////////////////
	// Auto-close
	//////////////////////////////////////////
	var z = document.createElement('div');
	z.className = 'zoomieSeconds';
	z.setAttribute('style', 'display:none;');
	elements.ignoreContainer.appendChild(z);
	elements.autoCloseDiv = z;
	
	// 
	var z = document.createElement('label');
	z.innerText = 'Auto-close rooms after (seconds):  ';
	z.style.cursor = 'pointer';
	elements.autoCloseLabel = z;
	elements.autoCloseDiv.appendChild(z);
	
	// 
	var z = document.createElement('input');
	z.type = 'number';
	z.min = 0; // No negatives
	z.size = 4;
	z.className = 'zoomieSecondsInput';
	z.value = parseInt(localStorage['zoomie-closeTime']); // parseInt for cleaning
	elements.autoCloseLabel.appendChild(z);
	z.onchange = function() {
		localStorage['zoomie-closeTime'] = parseInt(this.value);
		console.log(log + 'Updated close time');
	}
	
	//////////////////////////////////////////
	// Round number
	//////////////////////////////////////////
	var z = document.createElement('div');
	z.className = 'zoomieSeconds';
	z.setAttribute('style', 'display:none;');
	elements.ignoreContainer.appendChild(z);
	elements.roundSelectDiv = z;
	
	// 
	var z = document.createElement('label');
	z.innerText = 'Current round:  ';
	z.style.cursor = 'pointer';
	elements.roundNumLabel = z;
	elements.roundSelectDiv.appendChild(z);
	
	// 
	var z = document.createElement('input');
	z.type = 'number';
	z.min = 1; // No negatives
	z.max = generatedPairs.length; // No negatives
	z.size = 4;
	z.className = 'zoomieSecondsInput';
	z.value = parseInt(localStorage['zoomie-roundNumber']); // parseInt for cleaning
	elements.roundNumLabel.appendChild(z);
	z.onchange = function() {
		if (this.value < 1) this.value = 1;
		localStorage['zoomie-roundNumber'] = parseInt(this.value);
		highlightRoundNum(parseInt(this.value));
		//~ console.log('(Zoomie) updated close time');
	}
	
	//////////////////////////////////////////
	// Accept ignored users button
	//////////////////////////////////////////
	var z = document.createElement('div');
	z.setAttribute('style', 'width: 100%; text-align: center; padding: 10px 0; background-color: #eee; border-bottom: 1px solid blue; display: none;');
	elements.ignoreContainer.appendChild(z);
	elements.okayButtonDiv = z;
	
	var z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;');
	z.className = 'btn btn-primary';
	z.innerText = 'Okay';
	z.onclick = addToRooms;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectAccept = z;
	
	//////////////////////////////////////////
	// Cancel button
	//////////////////////////////////////////
	var z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;margin-left: 4px;');
	z.className = 'btn btn-primary';
	z.innerText = 'Cancel';
	z.onclick = cancelIgnoreUsersSelect;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectCancel = z;
}

/**
 * After user clicks "Breakout Rooms" button, adds "Zoomie Settings".
 */
function attachBreakoutContainer() {
	
	// Check footer exists
	var y = document.getElementsByClassName(
		//'bo-mgmtwindow-content__footer'
		//'bo-room-not-started-footer__actions'
		'bo-room-not-started-footer__btn-wrapper'
	);
	if (!y.length) {
		setTimeout(attachBreakoutContainer, 100);
		return;
	}
	
	// Remove any users from rooms
	resetPairings(); 
	setTimeout(resetPairings, 200);
	setTimeout(resetPairings, 400);
	setTimeout(resetPairings, 1200);
  
	
	// Add listener to "Open All Rooms" button but only if it exists.
	if (!attachOpenAllRooms()) {
		setTimeout(attachBreakoutContainer, 200);
		return;
	}
	
	// Gets height of window to work with.
	getBreakoutRoomHeight();
	
	// Remove "Zoomie Settings" button if it exists.
	if (elements.autoButton) {
		try {
			elements.autoButton.parentNode.removeChild(elements.autoButton);
			elements.autoButton = null;
		} catch(e) {
		}
	}
	
	var z = document.createElement('button');
	y[0].insertBefore(z, y[0].firstChild);
	z.innerHTML = 'Zoomie Settings';
	z.onclick = showIgnoreUsersSelect;
	z.className = 
		'zmu-btn bo-bottom-btn zmu-btn--default zmu-btn__outline--blue';
	z.style.marginRight = '10px';
	elements.autoButton = z;	
}

/**
 * Perform an action when Open All Rooms is clicked.
 * 
 * @return: Boolean True if listener was added to "Open All Rooms" button.
 */
function attachOpenAllRooms() {
	var x = document.getElementsByClassName(
		'zmu-btn bo-bottom-btn zmu-btn--primary zmu-btn__outline--blue'
	);
	if (x[0]) {
		for (var i=0; i<x.length; i++) {
			if (x[i].innerText.trim() == 'Open All Rooms') {
				x[i].addEventListener('click', updatePairingsFinal, false);
				return true;
			}
		}
	}// else {
	//	console.log('(ZOOMIE) Missing "Open all rooms" button!');
	//	setTimeout(attachOpenAllRooms, 1000);
	//}
	return false;
}
/**
 * Fire events when Open All Rooms is clicked.
 */
function attachCloseAllRooms() {
	var x = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (x[0]) {
		for (var i=0; i<x.length; i++) {
			if (x[i].innerText.trim() == 'Close All Rooms') {
				x[i].addEventListener('click', closeAllRooms, false);
				// If there is an "auto-close" set, then use it now.
				setTimeout(autoCloseRooms,
					parseInt(localStorage['zoomie-closeTime'])*1000);
				break;
			}
		}
	} else {
		console.log(log, 'Missing "Close all rooms" button!');
		setTimeout(attachCloseAllRooms, 1000);
	}
}
/**
 * 
 */
function autoCloseRooms() {
	var x = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (x[0]) {
		for (var i=0; i<x.length; i++) {
			if (x[i].innerText.trim() == 'Close All Rooms') {
				x[i].click();
				break;
			}
		}
	}
}
/**
 * User accepted pairings and opened rooms, so finalize pairs list.
 */
function updatePairingsFinal() {
	var r = parseInt(localStorage['zoomie-roundNumber']);
	if (r >= generatedPairs.length) {
		// E.g., if there are 6 users there will be 5 rounds,
		// so if it's round 5 and there are 5 rounds, reset the counter.
		// Otherwise, e.g., if round 4, then make it round 5 next.
		localStorage['zoomie-roundNumber'] = 1;
	} else {
		localStorage['zoomie-roundNumber'] = r + 1;
	}
	
	// Remove the -Auto- button.
	elements.autoButton.parentNode.removeChild(elements.autoButton);
	
	// Attach to close all rooms button.
	setTimeout(attachCloseAllRooms, 100);
	
}

/**
 * Add back the -Auto- button.
 */
function closeAllRooms() {
	// auto button
	attachBreakoutContainer();
}

/**
 * Add checkboxes and radios to ignore or make users the odd-number user.
 */
function addUserSelect() {
	
	var div = elements.userIgnoreSelectList;
	div.innerHTML = '';
	
	// No users?
	if (!au || au.length == 0) {
		div.innerHTML = '<br><center><b>No users found!</b></center><br>';
		return;
	}
	
	// All users loop
	for (var i in au) {
		// [{name: '---'}, ...]
		var pnum = parseInt(i)+1; // Participant number. Start at 1, not 0.
		var z = document.createElement('div');
		z.setAttribute('style', 'width:100%;');
		z.className = 'ignoreList' + (i % 2 == 0 ? 'Odd' : 'Even');
		div.appendChild(z);
		// checkbox
		var y2 = document.createElement('input');
		y2.type = 'checkbox';
		y2.user = au[i].name;
		y2.className = 'zoomieRadio1';
		y2.onclick = function() {
			if (this.checked) {
				ignoredUsers[this.user] = true;
			} else {
				ignoredUsers[this.user] = false;
				// Make sure "odd-numbered" is unchecked.
				this.y1.checked = false;
				if (this.user == primaryCohost) {
					primaryCohost = ''; // reset
				}
			}
			
			// Reset round counter
			localStorage['zoomie-roundNumber'] = 1;
			// REGENERATE THE PAIRINGS and redraw
			hideIgnoreUsersSelect();
			showIgnoreUsersSelect();
		}
		z.appendChild(y2);
		// radio
		var y1 = document.createElement('input');
		y1.type = 'radio';
		y1.name = 'zoomie-radio'; // any name, doesn't matter
		y1.user = au[i].name;
		y1.className = 'zoomieRadio2';
		y1.onclick = function() {
			primaryCohost = this.user;
			// If primary cohost, then must be "ignored" by default.
			// So check the box automatically.
			if (!this.y2.checked) {
				this.y2.click();
			}
			
			// Reset round counter
			localStorage['zoomie-roundNumber'] = 1;
			// REGENERATE THE PAIRINGS and redraw
			hideIgnoreUsersSelect();
			showIgnoreUsersSelect();
		}
		z.appendChild(y1);
		
		// checked1
		if (au[i].name == primaryCohost) {
			y1.checked = true;
		}
		// checked2
		if (ignoredUsers[au[i].name] == true) {
			y2.checked = true;
		}
		// 
		y2.y1 = y1;
		y1.y2 = y2;
		// Name (hide overflow)
		var y = document.createElement('span');
		y.setAttribute('style', 'width: 16%;overflow:hidden;display:inline-block;');//
		y.innerText =  '('+(pnum<10 ? '0'+pnum : pnum)+') ' + au[i].name;
		z.appendChild(y);
		
		///////////////////////////////////////////////////////////////
		// If pairs have been generated, then show round pairings now.
		///////////////////////////////////////////////////////////////
		// 66% width (32% in use)
		var roundNum = parseInt(localStorage['zoomie-roundNumber']);
		for (var r in generatedPairs) {
			// r = round num
			for (var j in generatedPairs[r]) {
				// pairings
				var pairing = generatedPairs[r][j];
				var adduser = false;
				if (pairing['p1'] == au[i].name) {
					// add p2
					if (pairing['p2'] == null) {
						adduser = '--';
					} else {
						adduser = parseInt(userDict[pairing['p2']].index) + 1;
					}
				} else if (pairing['p2'] == au[i].name) {
					// add p1
					if (pairing['p1'] == null) {
						adduser = '--';
					} else {
						adduser = parseInt(userDict[pairing['p1']].index) + 1;
					}
				}
				if (adduser) {
					var y = document.createElement('span');
					y.setAttribute('style', 'width: 2%;height:24px;border:1px solid blue;overflow:hidden;display:inline-block;text-align:center;');
					y.innerText =  (adduser<10 ? '0'+adduser : adduser);
					z.appendChild(y);
					y.className = 'roundnums';// roundnums-'+(j+1);
					y.roundNum = parseInt(r)+1;
				}
			}
		}
		highlightRoundNum(roundNum);
	}
}

/**
 * @param round {integer} Round number to highlight.
 */
function highlightRoundNum(round) {
	var x = document.getElementsByClassName('roundnums');
	for (var i=0; i<x.length; i++) {
		if (x[i].roundNum == round) {
			x[i].style.fontWeight = 'bold';
		} else {
			x[i].style.fontWeight = 'normal';
		}
	}
}

/**
 * 
 * https://stackoverflow.com/questions/6648512/
 * 		scheduling-algorithm-for-a-round-robin-tournament
 */
function makeRoundRobinPairings(players) {
  var p = JSON.parse(JSON.stringify(players));

  // Remove ignores.
  var newp = [];
  var cohost = null;
  for (var i in p) {
	  if (!ignoredUsers[p[i].name]) {
		  newp.push(p[i].name);
	  }
  }
  
  if (newp.length % 2 == 1) {
    // If co-host
    if (primaryCohost)
		newp.push(primaryCohost);
	else
		newp.push(null);
  }
  p = JSON.parse(JSON.stringify(newp));
 
  ////////////////////////////////////////////
  // TESTER
  // var p = ['a', 'b', 'c', 'd', 'e', null]; 
  ////////////////////////////////////////////
  
  var playerCount = p.length;
  var rounds = playerCount - 1;
  var half = playerCount / 2;
  var tournamentPairings = [];
  var playerIndexes = p.map((_, i) => i); //1,2,0
  playerIndexes.shift()
  
  for (let round = 0; round < rounds; round++) {
    var roundPairings = [];
    var newPlayerIndexes = [0].concat(playerIndexes);
    var firstHalf = newPlayerIndexes.slice(0, half);
    var secondHalf = newPlayerIndexes.slice(half, playerCount).reverse();
	
    for (var i = 0; i < firstHalf.length; i++) {
      roundPairings.push({
        p1: p[firstHalf[i]],
        p2: p[secondHalf[i]],
      });
    }
    // rotating the array
    playerIndexes.push(playerIndexes.shift());
    tournamentPairings.push(roundPairings);
  }

  return tournamentPairings;
}

/**
 * Hide & cancel
 */
function cancelIgnoreUsersSelect() {
	detachSettings();
	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch(e) {		
	}
}
/**
 * Hide ignore users dialog box and run the pairing program.
 */
function hideIgnoreUsersSelect() {
	detachSettings();
	
	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch(e) {		
	}
}
/**
 * 
 */
function addToRooms() {
	// hide the zoomie select dialog
	hideIgnoreUsersSelect();
	
	// add users to rooms
	var r = parseInt(localStorage['zoomie-roundNumber']);
	var pairs = generatedPairs[r-1];
	var roomNo = 0;
	
	// Sanity check. No pairs (e.g., none or one user present).
	if (!generatedPairs || !pairs) {
		// Exit silently.
		console.log(log, 'no pairs', generatedPairs, pairs);
		return; 
	}
	// Sanity check. If there aren't enough rooms, then quit right off.
	if (ab.length < pairs.length) {
		// Need to have more breakout rooms!
		// Alert the zoomie user.
		alert('Please create more breakout rooms. There are not enough rooms for every pair of participants.');
		return; 
	}
	console.log(log, 'pairs:', pairs);
  
	// Loop to add to rooms
	for (var i in pairs) {
		var p = pairs[i];
		if (p.p1 == null || p.p2 == null) continue; // Leave out solos
		// Made it past non-participants. Open "Assign" dialog box.
		ab[roomNo].click();
		// Loops through checkboxes.
		var x = document.getElementsByClassName(
      'zmu-data-selector-item__checkbox'
		);
		for (var k=0; k<x.length; k++) {
			if (x[k].parentNode.parentNode.getAttribute('aria-label') == p.p1
			 || x[k].parentNode.parentNode.getAttribute('aria-label') == p.p2) {
				x[k].click();
			}
		}
		ab[roomNo].click(); // Close dialog
		roomNo++;
	}
	
}

/**
 * Show ignore users dialog box.
 */
function showIgnoreUsersSelect() {
	// Close any popup dialog boxes that are opened when user clicks
	// any of the "Assign" buttons.
	closeAssignPopups();
	
	// Remove any users from rooms, then populate the users field.
	resetPairings();
	
	// Update global user data.
	ab = getAllAssignButtons();
	if (!ab) { // silent fail after user alert
    console.log(log, '!ab');
		//return;
	}
	au = getAllAssignableUsers();
	if (!au) { // silent fail after user alert
		//return;
    console.log(log, '!au');
	}
	
	// Update makeUserDict
	makeUserDict();
	
	// Generate pairs if new run.
	generatedPairs = makeRoundRobinPairings(au);
	
	// If there are more pairs than current round #, then reset round #.
	// This would happen when there's a new meeting and there are no
	// users joined yet and the round number is still here from the 
	// last meeting.
	if (parseInt(localStorage['zoomie-roundNumber']) > generatedPairs.length) {
		localStorage['zoomie-roundNumber'] = 1;
	}
	
	// ALWAYS GENERATE...
				//~ if (!generatedPairs) {
					//~ // new
					//~ generatedPairs = makeRoundRobinPairings(au);
					//~ console.log('au', au);
					//~ console.log('generatedPairs', generatedPairs);
				//~ }
	
	// Attach the elements
	attachSettings(); // Create the elements.
	elements.userIgnoreSelectTitle.className = 'zoomie-ignoreUsersTitle zoomie-show';
	elements.ignoreContainer.className = 'zoomie-ignoreContainer zoomie-show';
	elements.userIgnoreSelect.style.display = '';
	elements.userIgnoreSelectAccept.style.display = '';
	elements.autoCloseDiv.style.display = '';
	elements.userIgnoreSelectList.style.display = '';
	elements.okayButtonDiv.style.display = '';
	elements.roundSelectDiv.style.display = '';
	elements.userIgnoreSelectCancel.style.display = '';
	
	// Users
	addUserSelect();
	
	// Hide background dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = 'none';
	} catch(e) {	
	}
}

/**
 * Closes all Assign button popups before running auto-assign.
 */
function closeAssignPopups() {
	var assignButtons = document.getElementsByClassName(
		'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost ' +
		'zmu-btn__outline--blue zmu-btn--sm'
	);
	var x = document.getElementsByClassName('zmu-tooltip__container');
	for (var i=0; i<x.length; i++) {
		if (x[i].innerHTML != '') {
			// Typically only one opened at a time.
			// Thus, could break here.
			// But for the sake of completeness, it's worth it to 
			// assume that in some case two dialog popups would
			// be open simultaneously.
			assignButtons[i].click();
		}
	}
}
/**
 * Go through every room and remove any users in the room.
 */
function resetPairings() {
	// Start by updating the assign buttons.
  // By default, Zoom places the host in the first breakout room when 
  // the page reloads.
  ab = getAllAssignButtons(); 
	for (var i=0; i<ab.length; i++) {
		ab[i].click(); // Open dialog
		var x = document.getElementsByClassName(
			'zmu-data-selector-item__checkbox zmu-data-selector-item__checkbox--checked'
		);
		for (var k=x.length-1; k>=0; k--) {
			x[k].click(); // Uncheck the user.
		}
		ab[i].click(); // Close dialog
	}
}

/**
 * 
 * @return {Array} y Returns an array of objects representing users.
 */
function getAllAssignableUsers() {
	// Relies on clicking the first Assign button.
	if (!ab[0]) {
    console.log(log, '!ab[0]', ab);
		return;
  }
	ab[0].click();
	
	//au = []; // Reset array.
	var x = document.getElementsByClassName(
		'zmu-data-selector-item__text bo-room-assign-list-scrollbar__item-text'
	);
	if (x.length == 0) {
		// No assignable users
		ab[0].click(); // Close the box
		return false;
	}
	var y = [];
	for (var i=0; i<x.length; i++) {
		// Add an attribute for our purposes
		y.push({
			name: x[i].innerText.trim()
		});
	}
	ab[0].click(); // Uncheck
	
	// Before returning, sort alphabetical.
	// This is a quick solution for the following issue:
	//  Users are ordered in the "Assign" section by when they
	//  join the meeting. But each time the users return from a 
	//  breakout session, they join the meeting in a different order
	//  than previously. It's best to organize by name alphabetically.
	//  Another option is to order by a global variable tracking
	//  a timestamp for the first time any person joins the meeting.
	//  But simply ordering alphabetically is easier.
	//  The issue is that the generatePairs function regenerates
	//  the matching on every round (even though it appears to be static).
	//  And generatePairs relies on the ordering of users!
	y.sort(function(a, b) {
		if(a.name < b.name) { return -1; }
		if(a.name > b.name) { return 1; }
		return 0;
	});
	
	return y;
}
/**
 * @return HTMLCollection of found elements.
 */
function getAllAssignButtons() {
	var x = document.getElementsByClassName(
		'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost zmu-btn__outline--blue zmu-btn--sm'
	);
	if (x.length == 0) {
		alert('(Zoomie) No assignable buttons!');
		return false;
	}
	return x;
}
function makeUserDict() {
	userDict = {}; // reset
	for (var i in au) {
		userDict[au[i].name] = {
			name: au[i].name,
			index: i
		}
	}
}

/**
 * Check for page load and then continue.
 */
var ih = '';
if (document.readyState == "complete"
	|| document.readyState == "interactive") {
	ih = document.body.innerHTML;
	load();
}
else {
	document.onreadystatechange = function () {
		if (document.readyState == "complete"
			|| document.readyState == "interactive") {
			ih = document.body.innerHTML;
			load();
		}
	}
}

/**
 * GM functions
 */
function GM_addStyle(css) {
	var style = document.createElement('style');
	style.textContent = css;
	document.getElementsByTagName('head')[0].appendChild(style);
}
