# Zoomie browser extension for Mozilla Firefox and Google Chrome.

This extension is now available as a Firefox add-on, which may be found online
at the Firefox add-ons website located here:
(https://addons.mozilla.org/en-US/firefox/addon/zoomieroundrobin/).

Overview video of the extension:
(https://www.youtube.com/watch?v=vkE3dhM6Hs0).

This extension has been submitted to the Google Chrome web store twice
and twice rejected (May 2020 / June 2020). The reason for rejection was
that the extension "appears to be suspicious". If you find this
extension useful, please feel free to send your feedback to the Google
web store providing your feedback regarding the extension. The extension
ID on the Google Chrome web store is "daponhefhijhmoopoijhmocanmjkahhb".
Feedback can be sent to: Chrome Web Store Developer Support
<chromewebstore-dev-support@google.com>.

# Overview

Round-robin Zoom breakout room organizer for breaking into groups of twos over multiple rounds with unique pairings.

This extension is only valid with "Paid" Zoom accounts as the breakout room feature is only available to users with these accounts. Unpaid Zoom users do not have access to the breakout room feature in rooms they are hosting.

The extension is similar to Zoom's "Automatically" split participants into rooms, but it goes further by adding consistent pairings over multiple breakout sessions. Specifically, Zoom's automatic splitting up participants is randomly generated. The extension thus allows a host to have round-robin pairings over multiple rounds of breakout sessions while ensuring that participants have a one-on-one breakout session with every other user in the meeting. A number of feature requests have been made to Zoom regarding addition of this feature (round-robin tournament style pairings for breakout rooms), but for the time being the company has chosen not to include the feature.

The extension is meant to be run by the meeting host. Participants in the meeting do not have access to the Breakout Rooms button. Participants may use the browser or desktop versions of the Zoom client, as typical.

Zoom includes a browser version of their video chat. The browser version of the Zoom video chat is available by navigating to the following web address: (https://web.zoom.us/wc/Zoom_Room_ID/start), replacing "Zoom_Room_ID" with your Zoom room ID. This link also appears when starting or joining a meeting from the browser.

![image](https://github.com/davidshumway/zoomie/assets/3892695/d6488741-82a8-47e1-a7a9-2878bc962eb9)

The extension adds a "Zoomie" button to the breakout rooms dialogue box, which may then be used to manage automating breakout rooms of two people over multiple rounds.

The extension was created by David Shumway, a PhD student at University of Illinois at Chicago, for use by the Trillium Awakening Teachers Circle (https://www.trilliumawakening.org/). The extension is open-source and may be used by any group or individual.

# Testing / Development

The extension can be tested in Firefox's "developer mode". Start by
cloning this reposity. Then browse to `about:debugging` in Firefox,
click on the "This Firefox" link, click "Load Temporary Add-on...",
and finally select any file within the root directory of this repository.

# Future work

Suggestions welcome! Future work includes adding the option to select the number of users to include in each breakout room. At present, the number of users is set to two.

# Version history

0.1.3 - Dec. 2023
- Fix for a few layout changes that caused the extension to stop working.
- Include the domain zoomgov.com (https://github.com/davidshumway/zoomie/issues/9).

0.1.2 - Feb. 2021
  
- Update CSS to match Zoom layout changes to the breakout window footer.
- General Zoomie CSS layout updates.

0.1.1 -

