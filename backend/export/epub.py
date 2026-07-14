import io
import zipfile
import html
from datetime import datetime


class EPUBExporter:
    def export(self, title: str, chapters: list[dict], segments_by_chapter: list[list[dict]], novel_id: str = "") -> bytes:
        safe = html.escape(title)
        ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        uuid = novel_id or "unknown"

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
            zf.writestr("META-INF/container.xml", f"""<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>""")

            spine = []
            manifest = []
            nav_points = []

            for i, ch in enumerate(chapters):
                ch_title = html.escape(ch.get("title") or f"Chapter {ch.get('number', i+1)}")
                ch_id = f"chap_{i}"
                spine.append(f'<itemref idref="{ch_id}"/>')
                segs = segments_by_chapter[i] if i < len(segments_by_chapter) else []
                paras = "\n".join(
                    f"<p>{html.escape(s['translation'])}</p>"
                    for s in segs if s.get("translation", "").strip()
                )
                zf.writestr(f"OEBPS/Text/chapter_{i}.xhtml", f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{ch_title}</title></head>
<body>
<h2>{ch_title}</h2>
{paras}
</body>
</html>""")
                manifest.append(
                    f'<item id="{ch_id}" href="Text/chapter_{i}.xhtml" media-type="application/xhtml+xml"/>'
                )
                nav_points.append(f"""
    <navPoint id="np_{i}" playOrder="{i+1}">
      <navLabel><text>{ch_title}</text></navLabel>
      <content src="Text/chapter_{i}.xhtml"/>
    </navPoint>""")

            zf.writestr("OEBPS/content.opf", f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata>
    <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">{safe}</dc:title>
    <dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language>
    <dc:identifier xmlns:dc="http://purl.org/dc/elements/1.1/" id="BookId">{uuid}</dc:identifier>
    <meta property="dcterms:modified">{ts}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="Text/style.css" media-type="text/css"/>
    {chr(10).join(manifest)}
  </manifest>
  <spine toc="ncx">
    {chr(10).join(spine)}
  </spine>
</package>""")

            zf.writestr("OEBPS/toc.ncx", f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="{uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>{safe}</text></docTitle>
  <navMap>
    {''.join(nav_points)}
  </navMap>
</ncx>""")

            zf.writestr("OEBPS/Text/style.css", "body{font-family:Georgia,serif;line-height:1.8;margin:1em;padding:0}h2{text-align:center}p{text-indent:2em;margin:0.3em 0}")

        return buf.getvalue()
