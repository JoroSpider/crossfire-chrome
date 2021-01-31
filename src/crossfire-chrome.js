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
			let temporarySet = new Set();
			let lastAxis;

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
			};

			const addPosition = link => {
				const rect = link.getBoundingClientRect();
				return {
					link: link,
					x: rect.left + rect.width / 2 + window.pageXOffset,
					y: rect.top + rect.height / 2 + window.pageYOffset
				};
			};

			const getPart = (link, axis) => {
				if (axis === VERTICAL_MOVE) {
					return link.y;
				} else {
					return link.x;
				}
			};

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

			const targetArray = isLinks => isLinks ? links : wakes;

			const addLink = (link, isLinks) => targetArray(isLinks).push(link);

			const clearLinks = isLinks => targetArray(isLinks).splice(0);

			const getLinks = isLinks => targetArray(isLinks).filter(link => isLinks ? enabled(link) : true).map(link => addPosition(link));

			const isTarget = node => (node.nodeName === A_TAG && node.hasAttribute('href'))
				|| (node.nodeName === INPUT && node.type !== HIDDEN)
				|| node.nodeName === BUTTON
				|| node.nodeName === SELECT;

			const collectLinks = (nodes, isLinks) =>
				Array.from(nodes).filter(node => isTarget(node)).forEach(node => addLink(node, isLinks));

			collectLinks(document.getElementsByTagName('*'), IS_LINKS);

			new MutationObserver(() => {
				clearLinks(IS_LINKS);
				collectLinks(document.getElementsByTagName('*'), IS_LINKS);
			}).observe(document.body, { childList: true, subtree: true });

			const canSee = (link, direction) => {
				const border = getBorder(link, direction.axis);
				const target = direction.axis === HORIZONTAL_MOVE ? window.innerHeight : window.innerWidth;
				return border.start < target && border.end > 0;
			};

			const canSeeBoth = link => canSee(link, DIRECTION.DOWN) && canSee(link, DIRECTION.RIGHT);

			const axisReversed = direction => ({ axis: !direction.axis, move: direction.move });

			const moveReversed = direction => ({ axis: direction.axis, move: -direction.move });

			const bothReversed = direction => moveReversed(axisReversed(direction));

			const overlapped = (link, current, axis) => {
				const targetBorder = getBorder(link.link, axis);
				const currentBorder = getBorder(current.link, axis);
				return targetBorder.start < currentBorder.end && targetBorder.end > currentBorder.start;
			};

			const getDistance = (source, destination) =>
				((source.x - destination.x) ** 2) + ((source.y - destination.y) ** 2);

			const getDirectionalDistance = (source, destination, direction) => {
				const sourceBorder = getBorder(source.link, !direction.axis, direction.move);
				const destinationBorder = getBorder(destination.link, !direction.axis, direction.move);
				return overlapped(destination, source, !direction.axis) ?
					Math.min(Math.abs(destinationBorder.start - sourceBorder.start), Math.abs(destinationBorder.end - sourceBorder.end)) :
					Math.abs(destinationBorder.start - sourceBorder.end);
			};

			const getNearer = (first, second, current, direction) =>
				getDirectionalDistance(current, first, direction) > getDirectionalDistance(current, second, direction) ? second : first;

			const traceWakes = (first, second, direction) => {
				if (wakes.length < 2) {
					return null;
				}
				for (const wake of getLinks(IS_WAKES).reverse().slice(1)) {
					const firstDistance = getDirectionalDistance(wake, first, axisReversed(direction));
					const secondDistance = getDirectionalDistance(wake, second, axisReversed(direction));
					if (firstDistance > secondDistance) {
						return second;
					} else if (firstDistance < secondDistance) {
						return first;
					}
				}
				return null;
			};

			const decideNext = (first, second, current, direction) => {
				let selected;
				const set = [first, second];
				const nearer = getNearer(first, second, current, direction);
				const result = traceWakes(first, second, direction);
				if (set.every(link => overlapped(link, current, direction.axis))) {
					selected = !overlapped(first, second, direction.axis) && result ? result : nearer;
					temporarySet.add(selected);
					temporarySet.delete(set.find(link => link !== selected));
					return selected;
				} else if (set.some(link => overlapped(link, current, direction.axis))) {
					selected = set.find(link => overlapped(link, current, direction.axis));
					temporarySet.add(selected);
					temporarySet.delete(set.find(link => link !== selected));
					return selected;
				} else {
					const crossNearer = getNearer(first, second, current, axisReversed(direction));
					if (overlapped(first, second, !direction.axis)) {
						selected = crossNearer;
					} else {
						selected = result ? result : crossNearer;
					}
					const opponent = Array.from(temporarySet).find(link =>
						overlapped(link, selected, direction.axis)
						&& getNearer(link, selected, current, direction) !== link
						&& getNearer(link, selected, current, axisReversed(direction)) !== link);
					return opponent ? opponent : selected;
				}
			};

			const getCurrentLink = () => {
				const current = document.activeElement;
				if (current !== wakes[wakes.length - 1]) {
					clearLinks(IS_WAKES);
				}
				if (isTarget(current) && canSeeBoth(current)) {
					return addPosition(current);
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
				if (direction.axis !== lastAxis && wakes.length > 1) {
					const last = wakes.slice(-1).pop();
					clearLinks(IS_WAKES);
					addLink(last, IS_WAKES);
				}
				const candidates = getLinks(IS_LINKS)
					.filter(link => Math.sign(getPart(link, direction.axis) - getPart(current, direction.axis))
						=== direction.move
						&& !overlapped(link, current, !direction.axis)
						&& canSeeBoth(link.link));
				if (candidates.length === 0) {
					if (direction.axis === VERTICAL_MOVE) {
						window.scrollBy(0, window.innerHeight / 2 * direction.move);
					} else {
						window.scrollBy(window.innerWidth / 2 * direction.move, 0);
					}
					return;
				} else {
					const target = candidates.reduce((first, second) => decideNext(first, second, current, direction));
					temporarySet.clear();
					lastAxis = direction.axis;
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
		});
})(document);

