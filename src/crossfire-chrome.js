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
	const INPUT = 'INPUT';
	const BUTTON = 'BUTTON';
	const SELECT = 'SELECT';
	const HIDDEN = 'hidden';
	const NONE = 'none';
	const FIXED = 'fixed';
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

			const enabled = link => {
				if (!link) {
					return false;
				}
				if (link === document.documentElement) {
					return true;
				}
				const style = document.defaultView.getComputedStyle(link);
				if (style.display === NONE || style.visibility === HIDDEN || style.position === FIXED || link.disabled) {
					return false;
				}
				return enabled(link.parentElement);
			}

			const getPositionedItem = link => {
				const center = getCenter(link);
				return { link: link, x: center.x + window.pageXOffset, y: center.y + window.pageYOffset };
			}

			const targetArray = isLinks => isLinks ? links : wakes;

			const addLink = (link, isLinks) => targetArray(isLinks).push(link);

			// const removeLink = (link, isLinks) => targetArray(isLinks).splice(targetArray(isLinks).indexOf(link), 1);

			const clearLinks = isLinks => targetArray(isLinks).splice(0);

			const getLinks = isLinks => targetArray(isLinks).filter(link => enabled(link)).map(link => getPositionedItem(link));

			const isTarget = node => (node.nodeName === A_TAG && node.hasAttribute('href'))
				|| (node.nodeName === INPUT && node.type !== HIDDEN)
				|| node.nodeName === BUTTON
				|| node.nodeName === SELECT;

			const collectLinks = (nodes, isLinks) =>
				Array.from(nodes).filter(node => isTarget(node)).forEach(node => addLink(node, isLinks));

			collectLinks(document.getElementsByTagName('*'), IS_LINKS);
			// addLink(links[0].link, IS_WAKES);

			new MutationObserver(() => {
				clearLinks(IS_LINKS);
				collectLinks(document.getElementsByTagName('*'), IS_LINKS);
			}).observe(document.body, { childList: true, subtree: true });
			// 引数をaxisだけにしたい
			const canSee = (link, direction) => {
				const border = getBorder(link, direction.axis);
				const target = direction.axis === HORIZONTAL_MOVE ? window.innerHeight : window.innerWidth;
				return border.start < target && border.end > 0;
			};

			const canSeeBoth = link => canSee(link, DIRECTION.DOWN) && canSee(link, DIRECTION.RIGHT);

			const getPartOfPosition = (link, axis) => {
				if (axis === VERTICAL_MOVE) {
					return link.y;
				} else {
					return link.x;
				}
			};

			const axisReversed = direction => ({ axis: !direction.axis, move: direction.move });

			const moveReversed = direction => ({ axis: direction.axis, move: -direction.move });

			const bothReversed = direction => moveReversed(axisReversed(direction));

			const getBorder = (link, axis, move) => {
				const rect = link.getBoundingClientRect();
				if (move !== -1) {
					move = 1;
				}
				if (axis === VERTICAL_MOVE) {
					return move + 1 ? { start: rect.left, end: rect.right } : { start: rect.right, end: rect.left };
				} else {
					return move + 1 ? { start: rect.top, end: rect.bottom } : { start: rect.bottom, end: rect.top };
				}
			};

			const overlapped = (link, current, axis) => {
				const targetParallel = getBorder(link.link, axis);
				const currentParallel = getBorder(current.link, axis);
				return targetParallel.start < currentParallel.end && targetParallel.end > currentParallel.start;
			};

			const getDistance = (source, destination) =>
				((source.x - destination.x) ** 2) + ((source.y - destination.y) ** 2);

			const getDirectionalDistance = (source, destination, direction) => {
				const sourceBorder = getBorder(source.link, !direction.axis, direction.move);
				const destinationBorder = getBorder(destination.link, !direction.axis, direction.move);
				return Math.abs(destinationBorder.start - sourceBorder.end);
			};

			const getNearer = (first, second, current, direction) =>
				getDirectionalDistance(current, first, direction) > getDirectionalDistance(current, second, direction) ? second : first;

			const getDegree = (link, current, direction) => {
				const x = getDirectionalDistance(current, link, direction);
				const y = Math.min(getDirectionalDistance(current, link, axisReversed(direction)),
					getDirectionalDistance(current, link, bothReversed(direction)));
				return Math.atan2(y, x);
			};

			const getCloser = (first, second, current, direction) =>
				getDegree(first, current, direction) > getDegree(second, current, direction) ? second : first;

			// TODO:
			const decideNext = (first, second, current, direction) => {
				const set = [first, second];
				const closer = getCloser(first, second, current, direction);
				const nearer = getNearer(first, second, current, direction);
				if (set.every(link => overlapped(link, current, direction.axis))) {
					return nearer;
				} else if (set.some(link => overlapped(link, current, direction.axis))) {
					return set.find(link => overlapped(link, current, direction.axis));
				} else {
					//if (closer === nearer || overlapped(first, second, direction.axis)) {
					//	return nearer;
					//} else if (overlapped(first, second, !direction.axis)) {
					//	return getNearer(first, second, current, axisReversed(direction));
					//}
					//return closer;
					return nearer;
				}
			};

			const getCurrentLink = () => {
				const current = document.activeElement;
				if (isTarget(current) && canSeeBoth(current)) {
					return getPositionedItem(current);
				} else {
					clearLinks(IS_WAKES);
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
					.filter(link => Math.sign(getPartOfPosition(link, direction.axis) - getPartOfPosition(current, direction.axis))
						=== direction.move
						&& !overlapped(link, current, !direction.axis)
						&& canSeeBoth(link.link, direction));
				if (candidates.length === 0) {
					if (direction.axis === VERTICAL_MOVE) {
						window.scrollBy(0, window.innerHeight / 2 * direction.move);
					} else {
						window.scrollBy(window.innerWidth / 2 * direction.move, 0);
					}
					return;
				} else {
					const target = candidates.reduce((first, second) => decideNext(first, second, current, direction));
					addLink(target.link, IS_WAKES);
					focus(target.link);
				}
			};

			function focus(node) {
				node.classList.add(CROSSFIRE_CHROME_FOCUS);
				var listener = node.addEventListener('blur', function (e) {
					node.classList.remove(CROSSFIRE_CHROME_FOCUS);
					node.removeEventListener('blur', listener, false);
				}, false);
				node.focus();
			}

			document.addEventListener('keydown', function (e) {
				if (document.activeElement.tagName === INPUT
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

