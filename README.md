# Zoom browser extension for Mozilla Firefox and Google Chrome.

See the original [README](https://github.com/davidshumway/zoomie/blob/master/README.md) for context.

# Overview

For our use case, round robin was not going to work.  In addition to avoiding
putting the same two people in a breakout room, we have to account for people
leaving and joining over the course of our event. Therefore, we evaluate
matches on a case by case basis instead of as a whole batch. Updating Zoomie to
have persistent storage across tab refreshes was also helpful for us. We added
forms to indicate which matches we would like to avoid and which matches have
happened in the recent past so as to avoid them in the near future. The host is
never sent to a breakout room, and we try to avoid matching Cohosts together.

# Future work

* Adding more breakout rooms programmatically.
