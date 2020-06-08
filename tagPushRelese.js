/* eslint no-console:0, max-len:0 */
// see <https://gitlab.com/help/web_hooks/web_hooks> for full json posted by GitLab
const MENTION_ALL_ALLOWED = false; // <- check that bot permission allow has mention-all before passing this to true.
const NOTIF_COLOR = '#6498CC';
const refParser = ref => ref.replace(/^refs\/(?:tags|heads)\/(.+)$/, '$1');
const displayName = name => (name && name.toLowerCase().replace(/\s+/g, '.'));
const atName = user => (user && user.name ? '@' + displayName(user.name) : '');
const makeAttachment = (author, text, color) => {
	return {
		author_name: author ? displayName(author.name) : '',
		author_icon: author ? author.avatar_url : '',
		text,
		color: color || NOTIF_COLOR,
	};
};
const pushUniq = (array, val) => ~array.indexOf(val) || array.push(val); // eslint-disable-line

class Script { // eslint-disable-line
	process_incoming_request({ request }) {
		try {
			let result = null;
			const channel = request.url.query.channel;
			const event = request.headers['x-gitlab-event'];
			switch (event) {
			case 'Tag Push Hook':
				result = this.tagEvent(request.content);
				break;
			default:
				result = this.unknownEvent(request, event);
				break;
			}
			if (result && result.content && channel) {
				result.content.channel = '#' + channel;
			}
			return result;
		} catch (e) {
			console.log('gitlabevent error', e);
			return this.createErrorChatMessage(e);
		}
	}

	createErrorChatMessage(error) {
		return {
			content: {
				username: 'Rocket.Cat ErrorHandler',
				text: 'Error occured while parsing an incoming webhook request. Details attached.',
				icon_url: '',
				attachments: [
					{
						text: `Error: '${error}', \n Message: '${error.message}', \n Stack: '${error.stack}'`,
						color: NOTIF_COLOR
					}
				]
			}
		};
	}

	unknownEvent(data, event) {
		return {
				content: {
						username: data.user ? data.user.name : (data.user_name || 'Unknown user'),
						text: `Unknown event '${event}' occured. Data attached.`,
						icon_url: data.user ? data.user.avatar_url : (data.user_avatar || ''),
						attachments: [
								{
										text: `${JSON.stringify(data, null, 4)}`,
										color: NOTIF_COLOR
								}
						]
				}
		};
	}

	tagEvent(data) {
		const release = HTTP('GET', 'https://gitlab.com/api/v4/projects/586906/releases', {
			headers: {
				'PRIVATE-TOKEN': '<YOUR GITLAB API TOKEN>'
			}
		}).result.data[0];

		const project = data.project || data.repository;
		const web_url = project.web_url || project.homepage;
		const tag = refParser(data.ref);
		const user = {
				name: data.user_name,
				avatar_url: data.user_avatar
		};

		let message;
		if (data.checkout_sha === null) {
			message = `deleted tag [${tag}](${web_url}/tags/)`;
		} else {
			message = `pushed tag [${tag} ${data.checkout_sha.slice(0, 8)}](${web_url}/tags/${tag})`;
		}
		return {
			content: {
				username: `gitlab/${project.name}`,
				icon_url: project.avatar_url || data.user_avatar || '',
				text: MENTION_ALL_ALLOWED ? '@all' : '',
				attachments: [
					makeAttachment(user, `${message} \n ${release.description}`, NOTIF_COLOR)
				]
			}
		};
	}
}
