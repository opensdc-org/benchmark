"""Check that the published page's local navigation and download targets exist."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class PageLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.urls = set(), []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"duplicate id: {attrs['id']}"
            self.ids.add(attrs["id"])
        for name in ("href", "src"):
            if attrs.get(name):
                self.urls.append(attrs[name])


def check_links(site: Path) -> None:
    page = PageLinks()
    page.feed((site / "index.html").read_text(encoding="utf-8"))
    for url in page.urls:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            continue
        if parsed.path:
            assert (site / unquote(parsed.path)).exists(), url
        elif parsed.fragment:
            assert unquote(parsed.fragment) in page.ids, url


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path, help="assembled website directory")
    check_links(parser.parse_args().site)
