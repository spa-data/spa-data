---
layout: page
title: Sketches
permalink: /sketches/
---
### Sample displays of musical ideas from Prokofiev's notebooks

__Playable transcriptions encoded in [MEI](https://music-encoding.org/) and displayed with [Verovio](https://www.verovio.org/index.xhtml)__

The Serge Prokofiev Archive contains sketchbooks in which Prokofiev wrote out brief, musical ideas. The SPA-data repository makes available a small corpus of these sketches in machine readable form for analysis, in both MEI and MusicXML formats. These pages use Verovio to display an SVG version of the encoded score and to play a midi stream generated from the stored file.

MEI and MusicXML files available under __[Data Files](../data-files)__ tab
<br><br>
<!-- Verovio document collection -->

<!-- <table>
{% tablerow  item in site.verovio cols:2 %}
<a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
{% endtablerow %}
</table> -->

<table>
{% tablerow  item in site.verovio cols:2 %}
<a href="{{ site.baseurl }}/verovio/{{ item.shortname }}/">{{ item.name }}</a>
{% endtablerow %}
</table>
