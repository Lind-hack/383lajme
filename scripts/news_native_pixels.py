"""Native Luna image verdicts: prohibit auxiliary vision and image stripping."""
import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path


class PixelReviewAbort(SystemExit):
    def __init__(self, reason):
        print('383_NATIVE_PIXELS_ABORT ' + reason, file=sys.stderr)
        super().__init__(78)


def refuse(*args, **kwargs):
    raise PixelReviewAbort('auxiliary vision or image stripping refused')


async def refuse_async(*args, **kwargs):
    refuse()


def image_digest(url):
    if not isinstance(url, str) or not url.startswith('data:image/') or ';base64,' not in url:
        raise PixelReviewAbort('expected native image bytes are absent')
    try:
        return hashlib.sha256(base64.b64decode(url.split(';base64,', 1)[1], validate=True)).hexdigest()
    except ValueError:
        raise PixelReviewAbort('invalid native image encoding')


def image_parts(value):
    if isinstance(value, dict):
        if value.get('type') == 'input_image':
            yield value
        for item in value.values():
            yield from image_parts(item)
    elif isinstance(value, list):
        for item in value:
            yield from image_parts(item)


def check_wire(payload, digest):
    parts = list(image_parts(payload.get('input')))
    if (payload.get('model') != 'gpt-6-luna' or payload.get('reasoning', {}).get('effort') != 'max'
            or payload.get('tools') or len(parts) != 1 or image_digest(parts[0].get('image_url')) != digest):
        raise PixelReviewAbort('wire model, effort, tools or exact image mismatch')


def install_guards(image):
    sys.path.insert(0, '/opt/hermes')
    import cli
    import run_agent
    import agent.image_routing as routing
    import agent.message_sanitization as sanitization
    import agent.conversation_loop as conversation
    import tools.vision_tools as vision
    from agent.transports.codex import ResponsesApiTransport

    image = image.resolve(strict=True)
    digest = hashlib.sha256(image.read_bytes()).hexdigest()
    state = {'wire_requests': 0, 'image_sha256': digest, 'provider':'openai-codex', 'model':'gpt-6-luna', 'effort':'max'}
    original_build = routing.build_native_content_parts
    original_wire = ResponsesApiTransport.build_kwargs
    original_init = cli.HermesCLI._init_agent

    def native(provider, model, cfg):
        if provider != 'openai-codex' or model != 'gpt-6-luna':
            raise PixelReviewAbort('unexpected routing provider/model')
        return 'native'

    def build(text, image_paths, image_urls=None):
        if image_urls or [Path(path).resolve() for path in image_paths] != [image]:
            raise PixelReviewAbort('unexpected image path or remote image')
        parts, skipped = original_build(text, image_paths, image_urls)
        attached = [part for part in parts if part.get('type') == 'image_url']
        if skipped or len(attached) != 1 or image_digest(attached[0]['image_url']['url']) != digest:
            raise PixelReviewAbort('attachment skipped or changed')
        return parts, skipped

    def wire(self, model, messages, tools=None, **params):
        payload = original_wire(self, model, messages, tools=tools, **params)
        check_wire(payload, digest)
        state['wire_requests'] += 1
        return payload

    def initialize(self, *args, **kwargs):
        result = original_init(self, *args, **kwargs)
        if self.agent.provider != 'openai-codex' or self.agent.api_mode != 'codex_responses':
            raise PixelReviewAbort('unexpected agent provider/transport')
        return result

    routing.decide_image_input_mode = native
    routing.build_native_content_parts = build
    cli.HermesCLI._init_agent = initialize
    cli.HermesCLI._preprocess_images_with_vision = refuse
    vision.vision_analyze_tool = refuse_async
    for module in (sanitization, conversation, run_agent):
        if not hasattr(module, '_strip_images_from_messages'):
            raise PixelReviewAbort('required strip guard hook unavailable')
        module._strip_images_from_messages = refuse
    ResponsesApiTransport.build_kwargs = wire
    return cli, state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True, type=Path)
    parser.add_argument('--prompt', required=True, type=Path)
    args = parser.parse_args()
    cli, state = install_guards(args.image)
    try:
        cli.main(query=args.prompt.read_text(encoding='utf-8'), image=str(args.image), provider='openai-codex', model='gpt-6-luna',
                 quiet=True, toolsets='none', ignore_rules=True, max_turns=2)
    except SystemExit as exc:
        if exc.code not in (0, None):
            raise
    if state['wire_requests'] < 1:
        raise PixelReviewAbort('no verified image request was sent')
    print('383_NATIVE_PIXELS_VERIFIED ' + json.dumps(state), file=sys.stderr)


if __name__ == '__main__':
    main()
