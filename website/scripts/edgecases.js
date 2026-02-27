var cantusetext, caniuse2;

function edgecases() {
	var issues = ``
	cantusetext = `<h1>PumpOS won't work here.</h1>
		<p>And that's nothing to worry about!<br>Update your browser, or just move to a better browser. </p>
		<p>Try these options:</p>
		<ul>
		<li><a href="https://www.google.com/chrome/">Google Chrome - install</a></li>
		<li><a href="https://www.mozilla.org/en-US/firefox/new/">Firefox - install</a></li>
	</ul><p>This is why you cannot get the best experience: </p><ol>`
	caniuse2 = `</ol>
	<p>But still, if you wish to continue, press 'OK'. But we are sure this won't give you the best results.</p>`

	if (typeof HTMLDialogElement == 'undefined') {
		issues = `<li><b>HTMLDialogElement Not supported: </b> We have taken some efforts to fix this for you.</li>`
		say(cantusetext + issues + caniuse2, "failed");
		(function () {
			if ('HTMLDialogElement' in window) return;
			class CustomDialog extends HTMLElement {
				constructor() {
					super();
					this._open = false;
					this._returnValue = '';
					this._handleClick = this._handleClick.bind(this);
				}

				static get observedAttributes() {
					return ['open'];
				}

				connectedCallback() {
					this.style.display = 'none';
					this.addEventListener('click', this._handleClick);
				}

				disconnectedCallback() {
					this.removeEventListener('click', this._handleClick);
				}

				attributeChangedCallback(name, oldValue, newValue) {
					if (name === 'open') {
						this._open = newValue !== null;
						this.style.display = this._open ? 'block' : 'none';
					}
				}

				get open() {
					return this._open;
				}

				set open(value) {
					this.setAttribute('open', value ? '' : null);
				}

				get returnValue() {
					return this._returnValue;
				}

				close(returnValue = '') {
					this._returnValue = returnValue;
					this.open = false;
					this.dispatchEvent(new Event('close'));
				}

				show() {
					this.open = true;
					this.dispatchEvent(new Event('show'));
				}

				showModal() {
					this.show();
				}

				_handleClick(event) {
					if (event.target === this) {
						this.close();
					}
				}
			}

			customElements.define('dialog', CustomDialog);
		})();
	}

	if (typeof localStorage == 'undefined') {
		issues = `<li><b>LocalStorage Not supported: </b> PumpOS cannot function without it.</li>`
		say(cantusetext + issues + caniuse2, "failed");
		badlaunch = true;
	}
}

function detectIE() {
	var ua = window.navigator.userAgent;

	var msie = ua.indexOf('MSIE ');

	var trident = ua.indexOf('Trident/');

	if (msie > 0 || trident > 0) {
		return true;
	} else {
		return false;
	}
}

const exit = function () {
	if (gid("terminal").open) {
		gid("terminal").close()
	}
}