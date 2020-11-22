// ==UserScript==
// @name         crossfire-chrome.js
// @namespace    http://d.hatena.ne.jp/mallowlabs/
// ==/UserScript==

(function (document) {

	const DEFAULT_BINDINGS = { DOWN: 'ArrowDown', UP: 'ArrowUp', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' }
	const VI_BINDINGS = { DOWN: 'j', UP: 'k', LEFT: 'h', RIGHT: 'l' }

	const A_TAG = A_TAG;
	const DIRECTION = {
		UP: { axis: false, move: -1 },
		DOWN: { axis: false, move: 1 },
		LEFT: { axis: true, move: -1 },
		RIGHT: { axis: true, move: 1 }
	};

	var KEY = {};

	chrome.extension.sendRequest({ name: "getPreferences" },
		function (response) {
			var binding = response.mode;
			if (!binding) { binding = "default"; }
			switch (binding) {
				case "vi":
					KEY = VI_BINDINGS;
					break;
				default:
					KEY = DEFAULT_BINDINGS;
			}
			let modifier = response.modifier;
			if (!modifier) { modifier = 'default'; }
			switch (modifier) {
				case 'control':
					KEY.MODIFIER = 'Control';
					break;
				default:
					KEY.MODIFIER = 'Shift';
			}

			var xlinks = [];
			var ylinks = [];
			// var modifierPressed = false;
			let links = [];
			let wakes = [];
			var CROSSFIRE_CHROME_FOCUS = "crossfire-chrome-focus";

			addStyle(".crossfire-chrome-focus:focus {outline: 2px solid #6baee6;}");

			function addStyle(css) {
				var heads = document.getElementsByTagName("head");
				if (heads.length == 0) { return; }
				var node = document.createElement("style");
				node.type = "text/css";
				node.appendChild(document.createTextNode(css));
				heads[0].appendChild(node);
			}

			const addLink = link => links.push({ link: link, x: getCenter(link.getBoundingClientRect()).x, y: getCenter(link.getBoundingClientRect()).y });

			Array.from(document.getElementsByTagName(A_TAG)).filter(a => a.href && isVisible(a)).forEach(a => addLink(a));

			const observer = new MutationObserver(mutations => {
				observer.disconnect();

				mutations.addedNodes.filter(mutation => mutation.nodeName === A_TAG).forEach(mutation => addLink(mutation));
				observer.observe(document.body, { childList: true, subtree: true });
			});
			observer.observe(document.body, { childList: true, subtree: true });

			// function collectRects() {
			// 	xlinks = []
			// 	ylinks = []
			// 	var ns = document.getElementsByTagName(A_TAG) // TODO use XPath
			// 	for (var i = 0, l = ns.length; i < l; i++) {
			// 		if (!(ns[i].hasAttribute("href") && isVisible(ns[i]))) {
			// 			continue; // link which has no href or is not visible should be ignore
			// 		}
			// 		var rect = ns[i].getBoundingClientRect();
			// 		xlinks.push({ dom: ns[i], rect: rect });
			// 		ylinks.push({ dom: ns[i], rect: rect });
			// 	}
			// 	xlinks.sort(function (a, b) { return getCenter(a.rect).x - getCenter(b.rect).x })
			// 	ylinks.sort(function (a, b) { return getCenter(a.rect).y - getCenter(b.rect).y })
			// }

			function getCenter(rect) {
				return { x: rect.left + (rect.width) / 2, y: rect.top + (rect.height) / 2 };
			}

			function isVisible(node) {
				if (node.tagName === 'HTML') {
					return true;
				}
				const style = document.defaultView.getComputedStyle(node);
				if (style.display === 'none' || style.visibility === 'hidden') {
					return false;
				}
				return isVisible(node.parentNode);
				// var tmp = node;
				// while (tmp.tagName != "HTML") {
				// 	var style = document.defaultView.getComputedStyle(tmp, "");
				// 	if (style.display == "none" || style.visibility == "hidden") {
				// 		return false;
				// 	}
				// 	tmp = tmp.parentNode;
				// }
				// return true;
			}

			const canSee = (node, isHorizontalMove) => {
				const center = getCenter(node.getBoundingClientRect());
				if (isHorizontalMove) {
					return center.bottom >= window.pageYOffset && center.top <= window.pageYOffset + window.innerHeight;
				} else {
					return center.right >= window.pageXOffset && center.left <= window.pageXOffset + window.innerWidth;
				}
			};

			/* FIXME too complex ... */
			// function isTarget(activeRect, targetRect, axis, direction) {
			// 	if (axis == "x") {
			// 		if (direction == 1 && activeRect.right < targetRect.right) {  // right
			// 			if (targetRect.bottom >= activeRect.top && targetRect.top <= activeRect.bottom) {
			// 				return (targetRect.left - activeRect.right);
			// 			} else if ((targetRect.bottom < activeRect.top) &&  // up
			// 				(targetRect.left - activeRect.right) > (activeRect.top - targetRect.bottom)) {
			// 				return (targetRect.left - activeRect.right) + (activeRect.top - targetRect.bottom);
			// 			} else if ((targetRect.top > activeRect.bottom) && // down
			// 				(targetRect.left - activeRect.right) > (targetRect.top - activeRect.bottom)) {
			// 				return (targetRect.left - activeRect.right) + (targetRect.top - activeRect.bottom);
			// 			}
			// 		} else if (direction == -1 && targetRect.left < activeRect.left) { // left
			// 			if (targetRect.bottom >= activeRect.top && targetRect.top <= activeRect.bottom) {
			// 				return (activeRect.left - targetRect.right);
			// 			} else if ((targetRect.bottom < activeRect.top) && // up
			// 				(activeRect.left - targetRect.right) > (activeRect.top - targetRect.bottom)) {
			// 				return (activeRect.left - targetRect.right) + (activeRect.top - targetRect.bottom);
			// 			} else if ((targetRect.top > activeRect.bottom) && // down
			// 				(activeRect.left - targetRect.right) > (targetRect.top - activeRect.bottom)) {
			// 				return (activeRect.left - targetRect.right) + (targetRect.top - activeRect.bottom);
			// 			}
			// 		}
			// 	} else if (axis == "y") {
			// 		if (direction == 1 && activeRect.bottom < targetRect.bottom) {  // down
			// 			if (activeRect.left <= targetRect.right && targetRect.left <= activeRect.right) {
			// 				return (targetRect.top - activeRect.bottom);
			// 			} else if ((targetRect.right < activeRect.left) && // left
			// 				(activeRect.left - targetRect.right) < (targetRect.top - activeRect.bottom)) {
			// 				return (targetRect.top - activeRect.bottom) + (activeRect.left - targetRect.right);
			// 			} else if ((targetRect.left > activeRect.right) && // right
			// 				(targetRect.left - activeRect.right) < (targetRect.top - activeRect.bottom)) {
			// 				return (targetRect.top - activeRect.bottom) + (targetRect.left - activeRect.right);
			// 			}
			// 		} else if (direction == -1 && targetRect.top < activeRect.top) {  // up
			// 			if (targetRect.right >= activeRect.left && targetRect.left <= activeRect.right) {
			// 				return (activeRect.top - targetRect.bottom);
			// 			} else if ((targetRect.right < activeRect.left) && // left
			// 				(activeRect.left - targetRect.right) < (activeRect.top - targetRect.bottom)) {
			// 				return (activeRect.top - targetRect.bottom) + (activeRect.left - targetRect.right);
			// 			} else if ((targetRect.left > activeRect.right) && // right
			// 				(targetRect.left - activeRect.right) < (activeRect.top - targetRect.bottom)) {
			// 				return (activeRect.top - targetRect.bottom) + (targetRect.left - activeRect.right);
			// 			}
			// 		}
			// 	}
			// 	return -1;
			// }

			const sortLinks = (first, second, direction) => {
				if (first > second) {
					return direction;
				} else if (first < second) {
					return -direction;
				} else {
					return 0;
				}
			}

			const reduceOne = (first, second, last) => {
				if (last && first - last > second - last) {
					return second;
				} else {
					return first;
				}
			}

			const navigate = direction => {
				// const current = wakes.length > 0 ? wakes.slice(-1)[0] : document.activeElement;
				const current = document.activeElement.getBoundingClientRect();
				let candidates;
				let target;
				switch (direction) {
					case DIRECTION.UP:
					case DIRECTION.DOWN:
						candidates = (
							direction === DIRECTION.UP ?
								links.filter(link => link.y > getCenter(current).y) :
								links.filter(link => link.y < getCenter(current).y)
						).sort((first, second) => sortLinks(first.y, second.y, directon.move));
						target = candidates.filter(link => link.y === candidates.find(link => canSee(link, direction.axis).y))
							.reduce((first, second) => reduceOne(first.y, second.y, wakes.slice(-1)[0].y));
						// target = candidates.sort((first, second) => sortLinks(first.y, second.y, directon.move))
						// 		.find(link => canSee(link, direction.axis));
						break;
					case DIRECTION.LEFT:
					case DIRECTION.RIGHT:
						candidates = (
							direction === DIRECTION.LEFT ?
								links.filter(link => link.x > getCenter(current).x) :
								links.filter(link => link.x < getCenter(current).x)
						).sort((first, second) => sortLinks(first.x, second.x, direction.move));
						target = candidates.filter(link => link.x === candidates.find(link => canSee(link, direction.axis).x))
							.reduce((first, second) => reduceOne(first.x, second.x, wakes.slice(-1)[0].x));
						// target = candidates.sort((first, second) => sortLinks(first.x, second.x, direction.move))
						// 		.find(link => canSee(link, direction.axis));
						break;
				}
				if (target) {
					const rect = target.getBoundingClientRect();
					wakes.push({ link: target, x: getCenter(rect).x, y: getCenter(rect).y });
					focus(target);
				}
			}

			// function navigateNext(links, axis, direction) {
			// 	var active = document.activeElement;
			// 	var ignore = false;
			// 	var activeRect = { left: -100, right: -100, top: -200, bottom: -100 };
			// 	if (active.tagName == A_TAG) {
			// 		ignore = true;
			// 		activeRect = active.getBoundingClientRect();
			// 	}
			// 	var start = (direction == 1) ? 0 : links.length - 1;
			// 	var minDistance = -1;
			// 	var nearestNode = null;
			// 	for (var i = start, l = links.length; 0 <= i && i < l; i += direction) {
			// 		if (!ignore) {
			// 			var distance = isTarget(activeRect, links[i].rect, axis, direction);
			// 			if (distance < 0) continue;
			// 			if (minDistance < 0 || distance < minDistance) {
			// 				minDistance = distance;
			// 				nearestNode = links[i].dom;
			// 			}
			// 		}
			// 		if (links[i].dom == document.activeElement) { //XXX want to use 'active' but not works ...
			// 			ignore = false;
			// 		}
			// 	}
			// 	if (nearestNode) {
			// 		focus(nearestNode);
			// 	}
			// }

			function focus(node) {
				node.classList.add(CROSSFIRE_CHROME_FOCUS);
				var listener = node.addEventListener('blur', function (e) {
					node.classList.remove(CROSSFIRE_CHROME_FOCUS);
					node.removeEventListener('blur', listener, false);
				}, false);
				node.focus();
			}

			function navigateRight() {
				// navigateNext(xlinks, "x", 1);
				navigate(DIRECTION.RIGHT);
			}
			function navigateLeft() {
				// navigateNext(xlinks, "x", -1);
				navigate(DIRECTION.LEFT);
			}
			function navigateDown() {
				// navigateNext(ylinks, "y", 1);
				navigate(DIRECTION.DOWN);
			}
			function navigateUp() {
				// navigateNext(ylinks, "y", -1);
				navigate(DIRECTION.UP);
			}

			document.addEventListener('keyup', function (e) {
				if (document.activeElement.tagName == "INPUT"
					|| document.activeElement.tagName == "TEXTAREA"
					|| document.activeElement.contentEditable == "true") {
					return; // ignore
				}
				switch (e.key) {
					case KEY.MODIFIER:
						modifierPressed = false;
						break;
				}
			}, false);
			document.addEventListener('keydown', function (e) {
				if (document.activeElement.tagName == "INPUT"
					|| document.activeElement.tagName == "TEXTAREA"
					|| document.activeElement.contentEditable == "true"
					|| e.defaultPrevented) {
					return; // ignore
				}
				switch (e.key) {
					// case KEY.MODIFIER:
					// 	modifierPressed = true;
					// 	collectRects();
					// 	break;
					case KEY.DOWN:
						if (KEY.MODIFIER == 'Control' && e.ctrlKey || KEY.MODIFIER == 'Shift' && e.shiftKey) {
							navigateDown();
							e.preventDefault();
						}
						break;
					case KEY.UP:
						if (KEY.MODIFIER == 'Control' && e.ctrlKey || KEY.MODIFIER == 'Shift' && e.shiftKey) {
							navigateUp();
							e.preventDefault();
						}
						break;
					case KEY.RIGHT:
						if (KEY.MODIFIER == 'Control' && e.ctrlKey || KEY.MODIFIER == 'Shift' && e.shiftKey) {
							navigateRight();
							e.preventDefault();
						}
						break;
					case KEY.LEFT:
						if (KEY.MODIFIER == 'Control' && e.ctrlKey || KEY.MODIFIER == 'Shift' && e.shiftKey) {
							navigateLeft();
							e.preventDefault();
						}
						break;
					default:
						break;
				}
			}, false);
			document.addEventListener('scroll', () =>
				wakes = wakes.filter(wake => canSee(wake, true) && canSee(wake, false)));
			// document.addEventListener('scroll', function (e) {
			// 	if (modifierPressed) {
			// 		collectRects();
			// 	}
			// }, false);
		});
})(document);

