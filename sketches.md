---
layout: page
title: Sketches
permalink: /sketches/
---
### Sample displays of musical ideas from Prokofiev's notebooks

Playable transcriptions encoded in [MEI](https://music-encoding.org/) and displayed with [Verovio](https://www.verovio.org/index.xhtml)

The Serge Prokofiev Archive contains sketchbooks where Prokofiev copied down brief, musical ideas. The SPA-data repository makes available a small corpus of these sketches in machine readable form for analysis, in both MEI and MusicXML formats. These pages use Verovio to display an SVG version of the encoded score and to play a midi stream generated from the stored file.

MEI and MusicXML files available under __[Data Files](../data-files)__ tab

<!-- Verovio document collection -->

<!-- <table>
{% tablerow  item in site.verovio cols:2 %}
<a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
{% endtablerow %}
</table> -->

<font size="+1">
<ul>
  {% for item in site.verovio %}
    <li>
      <a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
    </li>
  {% endfor %}
</ul>
</font>
