GW.define('Tool.REGISTER', 'tool', {
	order: 100,
	name: 'register',
	description: 'Register new mega.co.nz account',
	usages: [
               '--ephemeral [--password <password> | --password-file <path>]',
               '--email <email> --name <realname> [--password <password> | --password-file <path>]',
               '--confirm --signup-link <signuplink> [--password <password> | --password-file <path>]'
	],

	detail: [
		'You can register either full user account linked to some e-mail address, or temporary ephemeral account linked to user handle that will be generated by the server.',
		'Full account registration requires you to retrieve confirmation link from the MEGA Signup email, that will be sent to the provided e-mail address.',
		'This command is interactive, and you\'ll be asked to enter password and the signup confirmation link when necessary.',
		'No strength checking is done, so make sure you pick a strong password yourself.'
	],

	getOptsSpecCustom: function() {
		return [{
			longName: "email",
			arg: 'string',
			help: "Email serves as your new account username, that you'll be using to sign in.",
			argHelp: "EMAIL" 
		}, {
			longName: "name",
			arg: 'string',
			help: "Your real (or fake) name. Default is 'User'",
			argHelp: "REALNAME"    
		}, {
			longName: "confirm",
			help: 'Confirm account previously created by `megatools register`.'
		}, {
			longName: 'signup-link',
			arg: 'string',
			argHelp: 'SIGNUPLINK',
			help: 'You need to pass signup link from the confirmation email that was sent to `<email>`.'
		}, {
			longName: "ephemeral",
			help: "Create new ephemeral account. Ephemeral accounts may be removed at any time without prior notice, but they don't require e-mail confirmation."
		}, {
			longName: "password",
			shortName: 'p',
			arg: 'string',
			help: "Desired password. This option is less secure than the --password-file option.",
			argHelp: "PASSWORD"
		}, {
			longName: "password-file",
			arg: 'string',
			help: "Path to a file containing the desired password. All characters including leading and trailing spaces up to the first new line are used.",
			argHelp: "PATH"
		}, {
			longName: 'save-config',
			shortName: 's',
			help: 'Save login credentials to a configuration file specified by --config.'
		}, {
			longName: 'config',
			arg: 'string',
			argHelp: 'PATH',
			help: 'Configuration file path. Default is ' + MEGA_RC_FILENAME + ' in the current directory.'
		}];
	},

	examples: [{
		title: 'Simple interactive registration',
		commands: [
			'$ megatools register --save-config --email your@email.com --name "Your Name"',
			'$ megatools info'
		]
	}, {
		title: 'Batch registration',
		steps: [{
			description: 'First create a non-verified account:',
			commands: [
				'$ megareg --batch --email your@email.com --name "Your Name" --password "Your Password"'
			]
		}, {
			description: 'Now wait for a verification mail and run the command as asked:',
			commands: [
				'$ megareg --batch --confirm --signup-link @LINK@ --password "Your Password"'
			]
		}]
	}],

	run: function(defer) {
		// check options
		var opts = this.opts;
		var password, handle, signupCode;
		var api = new MegaAPI();

		if (!opts.email && !opts.confirm && !opts.ephemeral) {
			Log.error('Nothing to do!');
			defer.reject(10);
			return;
		}

		if (opts.email && !C.email_valid(opts.email)) {
			Log.error('Invalid email address ' + opts.email + '!');
			defer.reject(10);
			return;
		}

		if (opts.confirm) {
			if (opts['signup-link']) {
				signupCode = extractSignupCode(opts['signup-link']);
				if (!signupCode) {
					Log.error('Invalid signup link!');
					defer.reject(10);
					return;
				}
			} else {
				if (opts.batch) {
					Log.error('You need to provide signup link on the command line in batch mode.');
					defer.reject(10);
					return;
				}
			}
		}

		function doAction() {
			if (opts.email) {
				doRegister();
			} else if (opts.confirm) {
				doConfirm();
			} else if (opts.ephemeral) {
				doEphemeral();
			}
		}

		function extractSignupCode(v) {
			var m = String(v).match(/https:\/\/mega\.co\.nz\/#confirm([A-Za-z0-9_-]{80,150})/);
			if (m) {
				return m[1];
			}
		}

		function promptSignupLink(msg, done) {
			C.prompt(msg, function(v) {
				var code = extractSignupCode(v);
				if (code) {
					done(code);
				} else if (String(v).match(/abort/)) {
					done();
				} else {
					promptSignupLink(msg, done);
				}
			});
		}

		function doRegister() {
			Defer.chain([
				function() {
					return api.registerUser(opts.name || 'User', opts.email, password).done(function(res) {
						Log.debug('registerUser.done:', res);
					});
				},

				function(res) {
					if (opts.batch) {
						return Defer.resolved();
					}

					return Defer.defer(function(defer) {
						promptSignupLink('Check email account ' + opts.email + ' and enter signup link (or type abort): ', function(code) {
							if (code) {
								api.confirmUserFast(code, res.mk, res.pk, res.email).then(defer.resolve, defer.reject);
							} else {
								defer.reject('no_code', 'Aborted by the user!');
							}
						});
					});
				}
			]).then(function() {
				Log.verbose('Registration was successful!');
				saveConfig();
				defer.resolve();
			}, function(code, msg) {
				Log.error(msg);
				defer.reject(1);
			});
		}

		function confirmUser(code) {
			api.confirmUser(code, password).then(function(res) {
				handle = res.email;
				saveConfig();
				defer.resolve();
			}, function(code, msg) {
				Log.error(msg);
				defer.reject(1);
			});
		}

		function doConfirm() {
			if (signupCode) {
				confirmUser(signupCode);
				return;
			}

			promptSignupLink('Enter signup link (or type abort): ', function(code) {
				if (code) {
					confirmUser(code);
				} else {
					Log.error('Aborted by the user!');
					defer.reject(10);
				}
			});
		}

		function doEphemeral() {
			api.registerEphemeral(password).then(function(res) {
				handle = res.uh;
				saveConfig();
				defer.resolve();
			}, function(code, msg) {
				Log.error(msg);
				defer.reject(1);
			});
		}

		function saveConfig() {
			if (opts['save-config']) {
				var path = opts.config || MEGA_RC_FILENAME;

				if (!C.file_write(path, Duktape.Buffer(Duktape.enc('jx', {username: opts.email || handle, password: password}, null, '  ')))) {
					Log.warning('Failed to save config file at ' + path);
				}
			}
		}

		function askPassword(twice, cb) {
			C.prompt('Enter password: ', function(password1) {
				if (!twice) {
					password = password1;
					cb();
					return;
				}

				C.prompt('Repeat password: ', function(password2) {
					if (password1 != password2) {
						Log.error('Passwords don\'t match');
						defer.reject(10);
					} else {
						password = password1;
						cb();
					}
				}, true);
			}, true);
		}

		if (opts.password && opts['password-file']) {
			Log.error('Conflicting options --password and --password-file');
			defer.reject(10);
			return;
		}

		if (opts.password) {
			password = opts.password;
		} else if (opts['password-file']) {
			var data = C.file_read(opts['password-file']);
			if (data) {
				password = data.toString().split(/\r?\n/)[0];
			} else {
				Log.error('Can\'t read password file at ' + opts['password-file']);
				defer.reject(10);
				return;
			}
		}

		if (_.isUndefined(password)) {
			if (opts.batch) {
				Log.error('Please specify --password or --password-file');
				defer.reject(10);
				return;
			} else {
				askPassword(!opts.confirm, function() {
					doAction();
				});
			}
		} else {
			doAction();
		}
	}
});
