/**
 * Copyright David Shumway 2020
 * License: GPLv3
 * Contact: dshumw2@uic.edu
 *
 * Rewrite intentions:
 * Contact: tavaresjanelle@gmail.com
 * Avoid pairing the same people in breakout rooms while handling that
 * participants can come and go at any point during the meeting. Persistent
 * storage of matches between meetings, as well.
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
 *
 * 	if in localStorage, will the matches get above 10MB?
*
 */

/**
 * Global variables
 */
let logPrefix = 'Zoomie extension::';
let assignableUsers = [], // Assignable users
	assignButtons = [], // Assign buttons
	userDict = {}, // Always updates to match assignableUsers. {'name': {'name': <str>, 'index': <#>}}
	currentMatches = [],
	previousMatches = [],
	previousMatchesKey = "previousMatches",
	registeredMatches = new Map(),
	asterisksUsers = new Map(),
	matchesToAvoid = [], // based on username, which can change... FUN
	matchesToAvoidKey = "matchesToAvoid",
	cohosts = new Map(),
	primaryCohost = '',
	elements = {
		userIgnoreSelect: null,
		userIgnoreSelectAccept: null,
		userIgnoreSelectTitle: null,
		autoButton: null,

		zoomieSettingsInput: null,
		zoomieSettingsInputAccept: null,
		zoomieSettingsInputTitle: null,
		settingsAutoButton: null,
	},
	breakoutRoomHeight = 0,
	generatedPairs = false,
	breakoutWindowOpen = false // Tracks breakout dialog state (open/closed)
	;

/**
 * Initialize the program.
 */
function load() {
	// Add css styles
	add_styles()

	loadStorage()

	// Saved - time to close
	// Saved setting for auto-close time
	if (!localStorage['zoomie-closeTime']) {
		localStorage['zoomie-closeTime'] = 60;
	}

	// If less than 2 seconds, then zoom.us overwrites getBreakoutButton().
	//setTimeout(getBreakoutButton, 2000);
}

function updateStorage() {
	// append current matches to previous matches
	// previousMatches.stringify()
	// put updates in localStorage

	console.log(logPrefix+" entering updateStorage")
	let other = localStorage
	let storage = Window.localStorage
	console.log(logPrefix+"updateStorage0"+JSON.stringify(matchesToAvoid))
	other.setItem(matchesToAvoidKey, JSON.stringify(matchesToAvoid))
	console.log(logPrefix+"updateStorage1"+JSON.stringify(previousMatches))
	other.setItem(previousMatchesKey, JSON.stringify(previousMatches))
	console.log(logPrefix+"updateStorage2")
}

function loadStorage() {
	console.log(logPrefix+" entering loadStorage")
	let other = localStorage
	let storage = window.localStorage
	console.log(logPrefix+" loadStorage0 ")
	let value = other.getItem(matchesToAvoidKey)
	let str = JSON.stringify(value)
	if (str !== "null") {
		populateMatchesToAvoid(value)
	}
	console.log(logPrefix+" loadStorage1")
	value = other.getItem(previousMatchesKey)
	str = JSON.stringify(value)
	if (str !== "null") {
		console.log(logPrefix+JSON.stringify(value))
		populateMatches(value)
	}
	console.log(logPrefix+" loadStorage2")
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

	GM_addStyle('.zoomieInput {cursor: pointer; width: 50%; height: 80%; word-break: break-all}');

	// Overwrites to zoom styles

	GM_addStyle('.common-window {border: 0 !important; box-shadow: none !important; -webkit-box-shadow: none !important;}');

	GM_addStyle('.ReactModal__Content {transform: none !important; top: 4% !important; left: 0 !important;}');
	GM_addStyle('.ReactModal__Content--after-open {transform: none !important; top: 4% !important; left: 0 !important;}');

	GM_addStyle('#boRoomMgmtWindow {width: 98% !important; position: fixed !important; margin-left: 1%;}');
}

// Set an interval to watch for boRoomMgmtWindow element to appear.
// Once it appears, then add the Zoomie button.
// Then, set another interval to check when the boRoomMgmtWindow
// disappears.
window.setInterval(function() {
	//console.log(logPrefix + "Entering setInterval")
	// Breakout window popup
	let a = document.getElementById('boRoomMgmtWindow');
	if (a && !breakoutWindowOpen) {
		// Attach the Zoomie button.
		console.log(logPrefix + 'Breakout window opened');
		breakoutWindowOpen = true;
		setTimeout(attachBreakoutContainer, 200);
	} else if (!a && breakoutWindowOpen) {
		// Reset the breakoutWindowOpen boolean.
		breakoutWindowOpen = false;
	}

	//console.log(logPrefix + "Before Recreate button popup")
	// "Recreate" button popup
	let b = document.getElementsByClassName('recreate-paper__footer');
	if (b && b.length === 1 && !b[0].zoomie_mark) {
		b.zoomie_mark = 1;
		b[0].onclick = attachBreakoutContainer;
	}
}, 1000);



/**
 * Retrieve breakout room dialog box height.
 */
window.onresize = function() {
	getBreakoutRoomHeight();
}
function getBreakoutRoomHeight() {
	let x = document.getElementsByClassName('bo-mgmtwindow-content');
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
function attachZoomie() {
	console.log(logPrefix + "Entering attachZoomie()")

	////////////////////////////////////////////////////////////////
	// Dialog container
	////////////////////////////////////////////////////////////////
	let a = document.getElementById('boRoomMgmtWindow');

	// Container for "-Auto-" button dialog
	let z = document.createElement('div');
	z.className = 'zoomie-ignoreContainer';
	a.insertBefore(z, a.firstChild);
	elements.ignoreContainer = z;

	// Ignore users title bar
	z = document.createElement('div');
	z.className = 'zoomie-ignoreUsersTitle';
	z.innerText = 'Zoomie';
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectTitle = z;

	//////////////////////////////////////////
	// Ignore users main container
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;z-index:1002;display:none;background-color:#eee;overflow:auto;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelect = z;
	if (assignableUsers.length) {
		z.innerHTML =
			'<div class="ignoreLegend" style="width: 45% !important;overflow:hidden;">Participant</div>'+
			'<div class="ignoreLegend" style="width: 45% !important;overflow:hidden;">Partners</div>'+
			'<br style="clear:both" />';
	}

	// Ignore users div to contain
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;height:400px;z-index:1004;display:none;background-color:#eee;overflow:auto;border-bottom:1px solid blue;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectList = z;


	//////////////////////////////////////////
	// Auto-close
	//////////////////////////////////////////
	z = document.createElement('div');
	z.className = 'zoomieSeconds';
	z.setAttribute('style', 'display:none;');
	elements.ignoreContainer.appendChild(z);
	elements.autoCloseDiv = z;

	//
	z = document.createElement('label');
	z.innerText = 'Auto-close rooms after (seconds):  ';
	z.style.cursor = 'pointer';
	elements.autoCloseLabel = z;
	elements.autoCloseDiv.appendChild(z);

	//
	z = document.createElement('input');
	z.type = 'number';
	z.min = 0; // No negatives
	z.size = 4;
	z.className = 'zoomieSecondsInput';
	z.value = parseInt(localStorage['zoomie-closeTime']); // parseInt for cleaning
	elements.autoCloseLabel.appendChild(z);
	z.onchange = function() {
		localStorage['zoomie-closeTime'] = parseInt(this.value);
		console.log(logPrefix + 'Updated close time');
	}


	//////////////////////////////////////////
	// Accept ignored users button
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width: 100%; text-align: center; padding: 10px 0; background-color: #eee; border-bottom: 1px solid blue; display: none;');
	elements.ignoreContainer.appendChild(z);
	elements.okayButtonDiv = z;

	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;');
	z.className = 'btn btn-primary';
	z.innerText = 'Okay';
	z.onclick = addToRooms;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectAccept = z;

	//////////////////////////////////////////
	// Cancel button
	//////////////////////////////////////////
	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;margin-left: 4px;');
	z.className = 'btn btn-primary';
	z.innerText = 'Cancel';
	z.onclick = cancelIgnoreUsersSelect;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectCancel = z;
}

function attachZoomieSettings() {
	console.log(logPrefix + "Entering attachZoomieSettings()")

	////////////////////////////////////////////////////////////////
	// Dialog container
	////////////////////////////////////////////////////////////////
	let a = document.getElementById('boRoomMgmtWindow');

	// Container for "-Auto-" button dialog
	let z = document.createElement('div');
	z.className = 'zoomie-ignoreContainer';
	a.insertBefore(z, a.firstChild);
	elements.zoomieSettingsContainer = z;

	// Ignore users title bar
	z = document.createElement('div');
	z.className = 'zoomie-ignoreUsersTitle';
	z.innerText = 'Zoomie Settings';
	elements.zoomieSettingsContainer.appendChild(z);

	//////////////////////////////////////////
	// Zoomie settingsmain container
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;z-index:1002;display:none;background-color:#eee;overflow:auto;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingsInputTitle = z;
		z.innerHTML = // These are 50px tall. 12% + 26% + 60% = 98%
	//		'<div class="ignoreLegend" style="width: 8% !important;overflow:hidden;">Ignore</div>'+
	//		'<div class="ignoreLegend" style="width: 8% !important;overflow:hidden;">Co-host</div>'+
			'<div class="ignoreLegend" style="width: 50% !important;overflow:hidden;">Avoid Matches</div>'+
			'<div class="ignoreLegend" style="width: 50% !important;overflow:hidden;">Previous Matches</div>'+
			'<br style="clear:both" />';

	// Avoid matches div to contain
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;height:400px;z-index:1004;display:none;background-color:#eee;overflow:auto;border-bottom:1px solid blue;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingsInput = z;

	//
	z = document.createElement('input');
	z.type = 'textarea';
	z.value = JSON.stringify(matchesToAvoid, null, 2);
	z.className = 'zoomieInput';
	elements.zoomieSettingsInput.appendChild(z);
	z.onchange = function() {
		populateMatchesToAvoid(this.value)
		updateStorage()
		console.log(logPrefix + 'Updated matches to avoid');
	}

	//
	z = document.createElement('input');
	z.type = 'textarea';
	console.log(logPrefix+" putting value into input "+JSON.stringify(previousMatches))
	z.value = JSON.stringify(previousMatches, null, 2);
	z.className = 'zoomieInput';
	elements.zoomieSettingsInput.appendChild(z);
	z.onchange = function() {
		populateMatches(this.value)
		updateStorage()
		console.log(logPrefix + 'Updated previous matches');
	}

	//////////////////////////////////////////
	// Accept settings button
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width: 100%; text-align: center; padding: 10px 0; background-color: #eee; display:none; border-bottom: 1px solid blue;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingButtonDiv = z;

	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;');
	z.className = 'btn btn-primary';
	z.innerText = 'Okay';
	z.onclick = closeZoomieSettings;
	elements.zoomieSettingButtonDiv.appendChild(z);
	elements.zoomieSettingsInputAccept = z;
}

/**
 * After user clicks "Breakout Rooms" button, adds "Zoomie".
 */
function attachBreakoutContainer() {

	// Check footer exists
	let y = document.getElementsByClassName(
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
	setTimeout(resetPairings, 600);

	// Add listener to "Open All Rooms" button but only if it exists.
	if (!attachOpenAllRooms()) {
		setTimeout(attachBreakoutContainer, 200);
		return;
	}

	// Gets height of window to work with.
	getBreakoutRoomHeight();

	// Remove button if exists.
	if (elements.autoButton) {
		try {
			elements.autoButton.parentNode.removeChild(elements.autoButton);
			elements.autoButton = null;
		} catch(e) {
			console.log(logPrefix + 'Could not remove autoButton');
		}
	}

	if (elements.settingsAutoButton) {
		try {
			elements.settingsAutoButton.parentNode.removeChild(elements.settingsAutoButton);
			elements.settingsAutoButton = null;
		} catch(e) {
			console.log(logPrefix + 'Could not remove autoButton');
		}
	}

	let z = document.createElement('button');
	y[0].insertBefore(z, y[0].firstChild);
	z.innerHTML = 'Zoomie Settings';
	z.onclick = showZoomieSettings;
	z.className =
		'zmu-btn bo-bottom-btn zmu-btn--default zmu-btn__outline--blue';
		// Changed Feb. 2021
		//'zmu-btn zm-btn-legacy zmu-btn--default zmu-btn__outline--blue';
	z.style.marginRight = '10px';
	elements.settingsAutoButton = z;

	// An "auto"-pair button that can be clicked any number
	// of times, continuously randomly permutating the
	// people into breakout rooms of size=2.
	z = document.createElement('button');
	y[0].insertBefore(z, y[0].firstChild);
	z.innerHTML = 'Zoomie';
	z.onclick = showIgnoreUsersSelect;
	z.className =
		'zmu-btn bo-bottom-btn zmu-btn--default zmu-btn__outline--blue';
		// Changed Feb. 2021
		//'zmu-btn zm-btn-legacy zmu-btn--default zmu-btn__outline--blue';
	z.style.marginRight = '10px';
 	elements.autoButton = z;
}

/**
 * Perform an action when Open All Rooms is clicked.
 *
 * Update (Feb. 2021): Button class updated.
 *
 * @return: Boolean True if listener was added to "Open All Rooms" button.
 */
function attachOpenAllRooms() {
	let x = document.getElementsByClassName(
		'zmu-btn bo-bottom-btn zmu-btn--primary zmu-btn__outline--blue'
		// prior to Feb. 2021
		// 'zmu-btn zm-btn-legacy bottom-btn zmu-btn--primary zmu-btn__outline--blue'
	);
	if (x[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i=0; i<x.length; i++) {
			if (x[i].innerText.trim() === 'Open All Rooms') {
				x[i].addEventListener('click', updatePairingsFinal, false);
				return true;
			}
		}
	}
	return false;
}
/**
 * Fire events when Open All Rooms is clicked.
 */
function attachCloseAllRooms() {
	let x = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (x[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i=0; i<x.length; i++) {
			if (x[i].innerText.trim() === 'Close All Rooms') {
				x[i].addEventListener('click', closeAllRooms, false);
				// If there is an "auto-close" set, then use it now.
				setTimeout(autoCloseRooms,
					parseInt(localStorage['zoomie-closeTime'])*1000);
				break;
			}
		}
	} else {
		console.log(logPrefix + 'Missing "Close all rooms" button!');
		setTimeout(attachCloseAllRooms, 1000);
	}
}
/**
 *
 */
function autoCloseRooms() {
	let x = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (x[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i=0; i<x.length; i++) {
			if (x[i].innerText.trim() === 'Close All Rooms') {
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

	// Remove the -Auto- button.
	elements.autoButton.parentNode.removeChild(elements.autoButton);

	// Attach to close all rooms button.
	setTimeout(attachCloseAllRooms, 100);

	console.log(logPrefix+" updatePairingsFinal before len(previousMatches) "+previousMatches.length)
	previousMatches = previousMatches.concat(currentMatches)
	console.log(logPrefix+" updatePairingsFinal after len(previousMatches) "+previousMatches.length)
	currentMatches = []

	updateStorage()
}

/**
 * Add back the -Auto- button.
 */
function closeAllRooms() {
	attachBreakoutContainer();
}

/**
 * Add checkboxes and radios to ignore or make users the odd-number user.
 */
function addUserSelect() {
	let div = elements.userIgnoreSelectList;
	div.innerHTML = '';

	// No users?
	if (!assignableUsers || assignableUsers.length === 0) {
		div.innerHTML = '<br><center><b>No users found!</b></center><br>';
		return;
	}

	// All users loop
	for (let i in currentMatches) {
		let pnum = parseInt(i)+1; // Participant number. Start at 1, not 0.
		let matches = currentMatches[i].Participants
		let z = document.createElement('div');
		z.setAttribute('style', 'width:100%;');
		z.className = 'ignoreList' + (i % 2 === 0 ? 'Odd' : 'Even');
		div.appendChild(z);

		let y = document.createElement('span');
		y.setAttribute('style', 'width: 5%;height:24px;overflow:hidden;display:inline-block;');
		y.innerText =  '('+(pnum<10 ? '0'+pnum : pnum)+') ';
		z.appendChild(y);


		let x = document.createElement('span');
		x.setAttribute('style', 'width: 25%;height:24px;border:1px solid blue;overflow:hidden;display:inline-block;text-align:center;');
		x.innerText = matches[0].DisplayName;
		z.appendChild(x);

		let w = document.createElement('span');
		w.setAttribute('style', 'width: 25%;height:24px;border:1px solid blue;overflow:hidden;display:inline-block;text-align:center;');
		w.innerText = matches[1].DisplayName;
		z.appendChild(w);
	}
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
	//let r = parseInt(localStorage['zoomie-roundNumber']);
	let roomNo = 0;

	// Sanity check. No pairs (e.g., none or one user present).
	if (!currentMatches) {
		// Exit silently.
		return;
	}
	// Sanity check. If there aren't enough rooms, then quit right off.
	if (assignButtons.length < currentMatches.length) {
		// Need to have more breakout rooms!
		// Alert the zoomie user.
		alert('Please create more breakout rooms. There are not enough rooms for every pair of participants.');
		return;
	}

	// Loop to add to rooms
	for (let i in currentMatches) {
		let p = currentMatches[i].Participants;
		if (p[0].DisplayName === null || p[1].DisplayName === null) continue; // Leave out solos
		// Made it past nulls. Open "Assign" dialog box.
		assignButtons[roomNo].click();
		// Loops through checkboxes.
		let x = document.getElementsByClassName(
			'zmu-data-selector-item__text'
		);
		for (let k=0; k<x.length; k++) {
			if (x[k].innerText === p[0].DisplayName
			 || x[k].innerText === p[1].DisplayName) {
				x[k].click();
			}
		}
		assignButtons[roomNo].click(); // Unclick/Close
		roomNo++;
	}

}

/**
 *
 */
function closeZoomieSettings() {
	elements.zoomieSettingsContainer.parentNode.removeChild(elements.zoomieSettingsContainer);

	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch(e) {

	}
}

/**
 * Show ignore users dialog box.
 */
function showIgnoreUsersSelect() {
	console.log(logPrefix+'entering showIgnoreUsersSelect')
	// Close any popup dialog boxes that are opened when user clicks
	// any of the "Assign" buttons.
	closeAssignPopups();

	// Remove any users from rooms, then populate the users field.
	resetPairings();

	// Update global user data.
	assignButtons = getAllAssignButtons();
	if (!assignButtons) { // silent fail after user alert
		//return;
	}
	assignableUsers = getAllAssignableUsers();
	if (!assignableUsers) { // silent fail after user alert
		//return;
	}

	// Update makeUserDict
	makeUserDict();

	// Generate pairs if new run.
	// currentMatches = makeRoundRobinPairings(assignableUsers);
	generatedPairs = makeMatches(assignableUsers)
	console.log(logPrefix + "currentMatches "+currentMatches.length)

	// Attach the elements
	attachZoomie(); // Create the elements.
	elements.userIgnoreSelectTitle.className = 'zoomie-ignoreUsersTitle zoomie-show';
	elements.ignoreContainer.className = 'zoomie-ignoreContainer zoomie-show';
	elements.userIgnoreSelect.style.display = '';
	elements.userIgnoreSelectAccept.style.display = '';
	elements.autoCloseDiv.style.display = '';
	elements.userIgnoreSelectList.style.display = '';
	elements.okayButtonDiv.style.display = '';
	elements.userIgnoreSelectCancel.style.display = '';

	// Users
	addUserSelect();

	// Hide the background dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = 'none';
	} catch(e) {

	}
}

/**
 * Show Zoomie settings.
 */
function showZoomieSettings() {
	// Close any popup dialog boxes that are opened when user clicks
	// any of the "Assign" buttons.
	closeAssignPopups();

	// Remove any users from rooms, then populate the users field.
	resetPairings();

	// Attach the elements
	attachZoomieSettings(); // Create the elements.
	elements.zoomieSettingsInputTitle.className = 'zoomie-ignoreUsersTitle zoomie-show';
	elements.zoomieSettingsContainer.className = 'zoomie-ignoreContainer zoomie-show';
	elements.zoomieSettingsInput.style.display = '';
	elements.zoomieSettingsInputAccept.style.display = '';
	elements.zoomieSettingButtonDiv.style.display = '';

	// Users
	// addUserSelect();

	// Hide the background dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = 'none';
	} catch(e) {

	}
}


/**
 * Closes all Assign button popups before running auto-assign.
 */
function closeAssignPopups() {
	let a = document.getElementsByClassName(
		'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost ' +
		'zmu-btn__outline--blue zmu-btn--sm'
	);
	let x = document.getElementsByClassName('zmu-tooltip__container');
	for (let i=0; i<x.length; i++) {
		if (x[i].innerHTML !== '') {
			// Typically only one opened at a time.
			// Thus, could break here.
			// But for the sake of completeness, it's worth it to
			// assume that in some case two dialog popups would
			// be open simultaneously.
			a[i].click();
		}
	}
}

function resetPairings() {
	currentMatches = []

	// Go through every room and remove any users in the room.
	for (let i=0; i<assignButtons.length; i++) {
		assignButtons[i].click(); // Open dialog
		let x = document.getElementsByClassName(
			'zmu-data-selector-item__checkbox zmu-data-selector-item__checkbox--checked'
		);
		for (let k = x.length - 1; k >= 0; k--) {
			//~ console.log('removing user from room');
			x[k].click(); // Unclick the user.
		}
		assignButtons[i].click(); // Close dialog
	}
}

function duplicateOrAvoid(firstUniqueName, secondUniqueName) {
	if (firstUniqueName === secondUniqueName) {
		console.log(logPrefix+"GAHHHHH");
		return {duplicate: false, avoid: true};
	}
	if (firstUniqueName === "") {
		console.log(logPrefix+"GAHHHHH");
		return {duplicate: false, avoid: true};
	}
	if (secondUniqueName === "") {
		console.log(logPrefix+"GAHHHHH");
		return {duplicate: false, avoid: true};
	}

	let one = registeredMatches.has(firstUniqueName+secondUniqueName)
	let two = registeredMatches.has(secondUniqueName+firstUniqueName)
	let duplicate = one && two


	firstUniqueName = firstUniqueName.toLowerCase()
	secondUniqueName = secondUniqueName.toLowerCase()
	let avoid = false
	console.log(logPrefix+"before avoid loop")
	for (let key in matchesToAvoid) {
		let firstAvoidLower = matchesToAvoid[key][0].toLowerCase()
		let secondAvoidLower = matchesToAvoid[key][1].toLowerCase()
		console.log(logPrefix+"inside avoid loop "+key+firstAvoidLower+secondAvoidLower)
		if (firstUniqueName.includes(firstAvoidLower)) {
			if (secondUniqueName.includes(secondAvoidLower)) {
				avoid = true
			}
		} else if (secondUniqueName.includes(firstAvoidLower)) {
			if (firstUniqueName.includes(secondAvoidLower)) {
				avoid = true
			}
		}
	}

	return {
		duplicate: duplicate,
		avoid: avoid,
	};
}

// if no non duplicate found by the end, start over at the beginning
function replaceWithAnyNonduplicate(matches, participants) {
	let participant = {DisplayName: participants[0], UniqueName: uniqueNameFromDisplayName(participants[0])}
	for (let i = 0; i < matches.length; i++) {
		let match = matches[i]
		let result = duplicateOrAvoid(participant.UniqueName, match.Participants[1].UniqueName)
		let dup = result.duplicate
		let avoid = result.avoid

		if (!dup && !avoid) {
			if (!match.Duplicate) {
				console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
				unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
			}
			console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[1].DisplayName);
			registerMatch(participant.UniqueName, match.Participants[1].UniqueName)
			matches[i] = {
				Participants: [participant, match.Participants[1]],
				Duplicate:    dup}
			participants[0] = match.Participants[0].DisplayName
			return true
		}

		result = duplicateOrAvoid(participant.UniqueName, match.Participants[0].UniqueName)
		dup = result.duplicate
		avoid = result.avoid
		if (!dup && !avoid) {
			if (!match.Duplicate) {
				console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
				unregisterMatch(match.Participants[1].UniqueName, match.Participants[0].UniqueName)
			}
			console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[0].DisplayName);
			registerMatch(participant.UniqueName, match.Participants[0].UniqueName)
			matches[i] = {
				Participants: [participant, match.Participants[0]],
					Duplicate:    dup}
			participants[0] = match.Participants[1].DisplayName
			return true
		}
	}
	return false
}

function replaceWithAnyCohost(matches, participant) {
	let lastFoundCohost = -1
	for (let i = 0; i < matches.length; i++) {
		let match = matches[i]

		if (isCohost(match.Participants[0])) {
			let result = duplicateOrAvoid(participant.UniqueName, match.Participants[1].UniqueName)
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				lastFoundCohost = i
			}
			if (!dup && !avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[1].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[1].UniqueName)

				matches[i] = {
					Participants: [participant, match.Participants[1]],
						Duplicate:    dup}
				return true
			}
		}
		if (isCohost(match.Participants[1])) {
			let result = duplicateOrAvoid(participant.UniqueName, match.Participants[0].UniqueName)
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				lastFoundCohost = i
			}
			if (!dup && !avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[0].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[0].UniqueName)

				matches[i] = {
					Participants: [participant, match.Participants[0]],
						Duplicate:    dup}
				return true
			}
		}
	}

	if (lastFoundCohost !== -1) {
		let match = matches[lastFoundCohost]
		if (isCohost(match.Participants[0])) {
			let result = duplicateOrAvoid(participant.UniqueName, match.Participants[1].UniqueName)
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[1].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[1].UniqueName)

				matches[lastFoundCohost] = {
					Participants: [participant, match.Participants[1]],
						Duplicate:    dup}
				return true
			}
		}
		if (isCohost(match.Participants[1])) {
			let result = duplicateOrAvoid(participant.UniqueName, match.Participants[0].UniqueName)
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching "+match.Participants[0].DisplayName+" and "+match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching "+participant.DisplayName+" and "+match.Participants[0].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[0].UniqueName)

				matches[lastFoundCohost] = {
					Participants: [participant, match.Participants[1]],
						Duplicate:    dup}
				return true
			}
		}
	}
	return false
}

function registerMatch(firstUniqueName, secondUniqueName) {
	registeredMatches.set(firstUniqueName+secondUniqueName, true)
	registeredMatches.set(secondUniqueName+firstUniqueName, true)
}

function unregisterMatch(firstUniqueName, secondUniqueName) {
	registeredMatches.delete(firstUniqueName+secondUniqueName)
	registeredMatches.delete(secondUniqueName+firstUniqueName)
}

function populateMatches(blob) {
	previousMatches = []
	if (blob == "" || blob == null || blob == "null") {
		console.log(logPrefix+"populateMatches0"+blob)
		blob = "{}"
	}
	console.log(logPrefix+"populateMatches1"+blob)
	try {
		previousMatches = JSON.parse(blob)
	} catch {
		previousMatches = []
	}
	console.log(logPrefix+"populateMatches2 "+previousMatches.length)
	registeredMatches.clear()

	for (let i = 0; i < previousMatches.length; i++) {
		// to registeredMatches
		registerMatch(previousMatches[i].Participants[0].UniqueName, previousMatches[i].Participants[1].UniqueName)
	}
}

function populateMatchesToAvoid(blob) {
	matchesToAvoid = []
	if (blob == "" || blob == null || blob == "null") {
		console.log(logPrefix+"populateMatchesToAvoid0"+blob)
		blob = "{}"
	}
	// format [][]string [['rose', 'larry'], ['a', 'b']]
	console.log(logPrefix+"populateMatchesToAvoid1"+blob)
	try {
		matchesToAvoid = JSON.parse(blob)
	} catch {
		matchesToAvoid = []
	}
	console.log(logPrefix+"populateMatchesToAvoid2 "+matchesToAvoid.length)
}

function isCohost(username) {
	return cohosts.get(username) !== undefined
}

function makeMatches(assignableUsers) {
	currentMatches = []
	let availableParticipants = [...assignableUsers]

	while (availableParticipants.length >= 2) {
		console.log(logPrefix + 'Remaining available participants to match '+ availableParticipants.length);
		let second = 1

		// shouldn't be necessary anymore
		if (availableParticipants[0] === "") {
  			availableParticipants.splice(0, 1);
			  continue
		}
		if (availableParticipants[second] === "") {
  			availableParticipants.splice(second, 1);
			  continue
		}
		let firstParticipant = {DisplayName: availableParticipants[0], UniqueName: uniqueNameFromDisplayName(availableParticipants[0])}
		let secondParticipant = {DisplayName: availableParticipants[second], UniqueName: uniqueNameFromDisplayName(availableParticipants[second])}

		let result = duplicateOrAvoid(firstParticipant.UniqueName, secondParticipant.UniqueName)
		let dup = result.duplicate
		let avoid = result.avoid

		if (dup || avoid) {
			console.log(logPrefix + "found a duplicate ("+dup+") avoid ("+avoid+") between "+availableParticipants[0]+" and "+ availableParticipants[second])
		}
		while ((dup || avoid) && (second <= availableParticipants.length-2)) { // -1 for index numbering and -1 for line 140
			console.log(logPrefix + "trying to fix")
			second++
			secondParticipant = {DisplayName: availableParticipants[second], UniqueName: uniqueNameFromDisplayName(availableParticipants[second])}
			result = duplicateOrAvoid(firstParticipant.UniqueName, secondParticipant.UniqueName)
			dup = result.duplicate
			avoid = result.avoid
		}

		let avoided = true
		if (dup || avoid) {
			// if no non duplicate found by the end, start over at the beginning
			let ok = replaceWithAnyNonduplicate(currentMatches, availableParticipants)
			if (!ok) {
				avoided = false
				console.log(logPrefix + "Unable to avoid duplicate!")
			} else {
				dup = false
				avoid = false
				continue
			}
		}

		if ((!dup && !avoid) || (dup && !avoided)) {
			registerMatch(firstParticipant.UniqueName, secondParticipant.UniqueName);
			console.log(logPrefix + "Matching "+availableParticipants[0]+" and "+availableParticipants[second]+" ("+ second+")");
			let m = {
				Duplicate: dup,
				Participants: [firstParticipant, secondParticipant]
			};
			currentMatches.push(m);
  			availableParticipants.splice(second, 1);
  			availableParticipants.splice(0, 1);
		} else {
			console.log(logPrefix + "Skipping participant because of avoid!")
			availableParticipants.splice(0, 1);
		}

		if (availableParticipants.length === 1) {
			firstParticipant = {DisplayName: availableParticipants[0], UniqueName: uniqueNameFromDisplayName(availableParticipants[0])}
			if (!isCohost(firstParticipant.DisplayName)) {
				console.log(logPrefix + "BAD! odd participant left out")
				// switch odd participant with any cohost

				let ok = replaceWithAnyCohost(currentMatches, availableParticipants)
				if (!ok) {
					console.log(logPrefix + "Well this is awkward... couldn't find a cohost to switch with the odd participant")
				}
			}
		}
	}

	return true
}

function uniqueNameFromDisplayName(displayName) {
	let parts = displayName.split(" ")
	let firstIndex = 0
	let secondIndex = 1


	for (let i = 0; i < parts.length; i++) {
		let part = parts[i]

		if (isPronoun(part) || isColor(part)) {
			if (i === 0) {
				firstIndex++
				secondIndex++
				continue
			}
			return parts.slice(firstIndex, secondIndex-1).join(" ").trim()
		}
		secondIndex++
	}
	return parts.slice(firstIndex, secondIndex).join(" ").trim()
}

function isColor(part) {
	let lower = part.toLowerCase().trim()
	switch (lower) {
		case "r":
		case "y":
		case "g":
			return true
		default:
			return false
	}
}

function isPronoun(part) {
	let lower = part.toLowerCase().trim()
	if (lower.includes("/")) {
		return true
	}
	if (lower.includes("(") || lower.includes(")")) {
		return true
	}
	switch (lower) {
		case "he":
		case "him":
		case "she":
		case "her":
		case "they":
		case "them":
			return true
		default:
			return false
	}

}

/**
 *
 * @return {Array} y Returns an array of objects representing users.
 */
function getAllAssignableUsers() {
	console.log(logPrefix + " getAllAssignableUsers0")

	// Relies on clicking the first Assign button.
	if (!assignButtons[0])
		return;
	assignButtons[0].click();

	console.log(logPrefix + " getAllAssignableUsers1")
	let x = document.getElementsByClassName(
		'zmu-data-selector-item__text bo-room-assign-list-scrollbar__item-text'
	);
	console.log(logPrefix + " getAllAssignableUsers2")
	if (x.length === 0) {
		console.log(logPrefix + " Found zero in the room list")
		//alert('(Zoomie) No assignable users!');
		assignButtons[0].click(); // Close the box
		return false;
	}

	// @TODO finish testing this
	console.log(logPrefix + " getAllAssignableUsers3 "+x.length)
	asterisksUsers.clear()
	let y = [];
	let lastCohost = "";
	for (let i=0; i<x.length; i++) {
		let username = x[i].innerText.trim()
		console.log(logPrefix + " getAllAssignableUsers3.2 "+username)
		let skip = username.includes("***")
		if (skip) {
			asterisksUsers.set(username, true)
			continue
		}
		console.log(logPrefix + " getAllAssignableUsers3.3 ")
		if (containsCohost(username) === true) {
		console.log(logPrefix + " getAllAssignableUsers3.31")
			cohosts.set(username, true)
		console.log(logPrefix + " getAllAssignableUsers3.32")
			if (lastCohost === "") {
		console.log(logPrefix + " getAllAssignableUsers3.33")
				lastCohost = username
				continue
			}
		console.log(logPrefix + " getAllAssignableUsers3.34")
		}
		console.log(logPrefix + " getAllAssignableUsers3.4")

		// Add an attribute for our purposes
		y.push(username)
		console.log(logPrefix + " getAllAssignableUsers3.5")
	}
	assignButtons[0].click(); // unclick
	console.log(logPrefix + " getAllAssignableUsers4")

	let shuffled = shuffle(y);
	if (lastCohost !== "") {
		shuffled.push(lastCohost)
	}
	console.log(logPrefix + " getAllAssignableUsers5")
	return shuffled;
}

function containsCohost(username) {
	let lower = username.toLowerCase()
	return lower.includes("cohost") ||
		lower.includes("co-host") ||
		lower.includes("co host");
}

/*
* Fisher-Yates (aka Knuth) Shuffle.
 */
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function getAllAssignButtons() {
	let x = document.getElementsByClassName(
		'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost zmu-btn__outline--blue zmu-btn--sm'
	);
	// @TODO click "Add Room" programmatically instead of requiring it manually
	if (x.length === 0) {
		alert('(Zoomie) No assignable buttons!');
		return false;
	}
	return x;
}

function makeUserDict() {
	userDict = {}; // reset
	for (let i in assignableUsers) {
		userDict[assignableUsers[i]] = {
			name: assignableUsers[i],
			index: i
		}
	}
}

/**
 * Check for page load and then continue.
 */
let ih = '';
if (document.readyState === "complete"
	|| document.readyState === "interactive") {
	ih = document.body.innerHTML;
	load();
}
else {
	document.onreadystatechange = function () {
		if (document.readyState === "complete"
			|| document.readyState === "interactive") {
			ih = document.body.innerHTML;
			load();
		}
	}
}

/**
 * GM functions
 */
function GM_addStyle(css) {
	let style = document.createElement('style');
	style.textContent = css;
	document.getElementsByTagName('head')[0].appendChild(style);
}
