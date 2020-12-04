// ==UserScript==
// @name         crossfire-chrome.js
// @namespace    http://d.hatena.ne.jp/mallowlabs/
// ==/UserScript==

(document => {

	const DEFAULT_BINDINGS = { DOWN: 'ArrowDown', UP: 'ArrowUp', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' }
	const VI_BINDINGS = { DOWN: 'j', UP: 'k', LEFT: 'h', RIGHT: 'l' }

	const CONTROL_KEY = 'Control';
	const SHIFT_KEY = 'Shift';

	const A_TAG = 'A';
	const ROOT = 'HTML';
	const BODY = document.body;
	const VERTICAL_MOVE = false;
	const HORIZONTAL_MOVE = true;
	const DIRECTION = {
		UP: { axis: VERTICAL_MOVE, move: -1 },
		DOWN: { axis: VERTICAL_MOVE, move: 1 },
		LEFT: { axis: HORIZONTAL_MOVE, move: -1 },
		RIGHT: { axis: HORIZONTAL_MOVE, move: 1 }
	};
	const IS_LINKS = true;
	const IS_WAKES = false;

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
					KEY.MODIFIER = CONTROL_KEY;
					break;
				default:
					KEY.MODIFIER = SHIFT_KEY;
			}

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

			let links = [];
			let wakes = [];

			const getCenter = link => {
				const rect = link.getBoundingClientRect();
				return { x: rect.left + (rect.width) / 2, y: rect.top + (rect.height) / 2 };
			};

			const visible = link => {
				if (link.tagName === ROOT) {
					return true;
				}
				const style = document.defaultView.getComputedStyle(link);
				if (style.display === 'none' || style.visibility === 'hidden') {
					return false;
				}
				return visible(link.parentElement);
			}

			const correctPosition = link => {
				const center = getCenter(link);
				return { link: link, x: center.x + window.pageXOffset, y: center.y + window.pageYOffset };
			}

			const targetArray = isLinks => isLinks ? links : wakes;

			const addLink = (link, isLinks) => targetArray(isLinks).push(link);

			const removeLink = (link, isLinks) => targetArray(isLinks) = targetArray(isLinks).filter(a => a !== link);
			const clearLinks = isLinks => targetArray(isLinks).splice(0);

			const getLinks = isLinks => targetArray(isLinks).filter(link => visible(link)).map(link => correctPosition(link));

			Array.from(document.getElementsByTagName(A_TAG)).filter(a => a.hasAttribute('href')).forEach(a => addLink(a, IS_LINKS));
			// addLink(links[0].link, IS_WAKES);

			const observer = new MutationObserver(mutations => {
				observer.disconnect();

				mutations.forEach(mutation => {
					Array.from(mutation.addedNodes).filter(node => node.nodeName === A_TAG).forEach(node => addLink(node, IS_LINKS));
					Array.from(mutation.removedNodes).filter(node => node.nodeName === A_TAG).forEach(node => removeLink(node, IS_LINKS));
				});

				observer.observe(BODY, { childList: true, subtree: true });
			});
			observer.observe(BODY, { childList: true, subtree: true });

			const canSee = (link, axis) => {
				const border = getStartAndEnd(link, axis);
				const target = axis === HORIZONTAL_MOVE ? window.innerHeight : window.innerWidth;
				return border.start < target && border.end > 0;
			};

			const canSeeBoth = (link, axis) => canSee(link, axis) && canSee(link, !axis);

			const targetPosition = (link, axis) => {
				if (axis === VERTICAL_MOVE) {
					return link.y;
				} else {
					return link.x;
				}
			};

			const getStartAndEnd = (link, axis, direction) => {
				const rect = link.getBoundingClientRect();
				if (!direction) {
					direction = 1;
				}
				if (axis === VERTICAL_MOVE) {
					return ++direction ? { start: rect.left, end: rect.right } : { start: rect.right, end: rect.left };
				} else {
					return ++direction ? { start: rect.top, end: rect.bottom } : { start: rect.bottom, end: rect.top };
				}
			};

			const overlapped = (link, current, axis) => {
				const targetParallel = getStartAndEnd(link.link, axis);
				const currentParallel = getStartAndEnd(current.link, axis);
				return targetParallel.start < currentParallel.end && targetParallel.end > currentParallel.start;
			};

			const getDistance = (source, destination) =>
				Math.sqrt(((source.x - destination.x) ** 2) + ((source.y - destination.y) ** 2));

			const getDegree = (link, current, axis) =>
				Math.atan2(Math.abs(targetPosition(link, !axis) - targetPosition(current, !axis)),
					Math.abs(targetPosition(link, axis) - targetPosition(current, axis)));

			const getMinDegreedItem = (first, second, current, axis) =>
				getDegree(first, current, axis) > getDegree(second, current, axis) ? second : first;

			const decideNext = (first, second, current, axis) => {
				if (canSeeBoth(first.link, axis) && !canSeeBoth(second.link, axis)) {
					return first;
				} else if (!canSeeBoth(first.link, axis) && canSeeBoth(second.link, axis)) {
					return second;
				} else if (!canSeeBoth(first.link, axis) && !canSeeBoth(second.link, axis)) {
					return getMinDegreedItem(first, second, current, axis);
				} else {
					if (overlapped(first, current, axis) && !overlapped(second, current, axis)) {
						return first;
					} else if (!overlapped(first, current, axis) && overlapped(second, current, axis)) {
						return second;
					} else if (overlapped(first, current, axis) && overlapped(second, current, axis)) {
						return Math.abs(targetPosition(first, axis) - targetPosition(current, axis))
							> Math.abs(targetPosition(second, axis) - targetPosition(current, axis)) ? second : first;
					} else {
						const firstBorder = getStartAndEnd(first.link, axis);
						const secondBorder = getStartAndEnd(second.link, axis);
						if (firstBorder.start === secondBorder.start || firstBorder.end === secondBorder.end) {
							return getDistance(current, first) > getDistance(current, second) ? second : first;
						} else {
							return getMinDegreedItem(first, second, current, axis);
						}
					}
				}
			};


			const getCurrentLink = () => {
				let current = document.activeElement;
				if (current.tagName === A_TAG && canSeeBoth(current, true)) {
					return correctPosition(current);
				} else {
					link = { x: window.pageXOffset, y: window.pageYOffset };
					return getLinks(IS_LINKS).reduce((now, another) => {
						if (getDistance(link, now) > getDistance(link, another)) {
							return another;
						} else {
							return now;
						}
					});
				}
			};

			const navigate = direction => {
				const current = getCurrentLink();
				const candidates = getLinks(IS_LINKS)
					.filter(link => Math.sign(targetPosition(link, direction.axis) - targetPosition(current, direction.axis))
						=== direction.move);
				if (candidates.length > 0) {
					const target = candidates.reduce((first, second) => decideNext(first, second, current, direction.axis));
					const targetBorder = getStartAndEnd(target.link, !direction.axis);
					const currentBorder = getStartAndEnd(current.link, !direction.axis);
					if (targetBorder.start !== currentBorder.start && targetBorder.end !== currentBorder.end) {
						focus(target.link);
					}
				}
			}

			function focus(node) {
				node.classList.add(CROSSFIRE_CHROME_FOCUS);
				var listener = node.addEventListener('blur', function (e) {
					node.classList.remove(CROSSFIRE_CHROME_FOCUS);
					node.removeEventListener('blur', listener, false);
				}, false);
				node.focus();
			}

			document.addEventListener('keydown', function (e) {
				if (document.activeElement.tagName == "INPUT"
					|| document.activeElement.tagName == "TEXTAREA"
					|| document.activeElement.contentEditable == "true"
					|| e.defaultPrevented) {
					return; // ignore
				}
				switch (e.key) {
					case KEY.DOWN:
						if (KEY.MODIFIER == CONTROL_KEY && e.ctrlKey || KEY.MODIFIER == SHIFT_KEY && e.shiftKey) {
							navigate(DIRECTION.DOWN);
							e.preventDefault();
						}
						break;
					case KEY.UP:
						if (KEY.MODIFIER == CONTROL_KEY && e.ctrlKey || KEY.MODIFIER == SHIFT_KEY && e.shiftKey) {
							navigate(DIRECTION.UP);
							e.preventDefault();
						}
						break;
					case KEY.RIGHT:
						if (KEY.MODIFIER == CONTROL_KEY && e.ctrlKey || KEY.MODIFIER == SHIFT_KEY && e.shiftKey) {
							navigate(DIRECTION.RIGHT);
							e.preventDefault();
						}
						break;
					case KEY.LEFT:
						if (KEY.MODIFIER == CONTROL_KEY && e.ctrlKey || KEY.MODIFIER == SHIFT_KEY && e.shiftKey) {
							navigate(DIRECTION.LEFT);
							e.preventDefault();
						}
						break;
					default:
						break;
				}
			}, false);
			document.addEventListener('scroll', () => {
			});
		});
})(document);

