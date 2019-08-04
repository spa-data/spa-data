---
layout: page
title: Data Files
permalink: /data-files/
---
## Prokofiev's Sketchbooks

These files contain machine-readable transcriptions of musical fragments from Prokofiev's sketchbooks. Sketches were first transcribed using standard music notation software (Sibelius and Musescore), then exported as __[MusicXML](https://www.musicxml.com/)__ files. The MusicXML files were converted to __[MEI](https://music-encoding.org/)__ using __[Verovio's](https://www.verovio.org/index.xhtml)__ MusicXML to MEI converter.
The __[Sketches](../sketches)__ page displays the MEI using the Verovio toolkit, which also converts the MEI to a MIDI stream playable in the web browser.

The __[Sketches](../sketches)__ page displays the MEI files as SVG images using the Verovio engraving toolkit, which also converts the MEI to a MIDI stream playable in the web browser.

__[MusicXML files](https://github.com/spa-data/spa-data/tree/master/meimidi/xml)__

__[MEI files](https://github.com/spa-data/spa-data/tree/master/meimidi/meiEdit)__


---

## Correspondence

This __XML__ file contains the entire set of records in _Series 2.1: Personal Correspondence_ formatted according to Columbia University Libraries' [Encoded Archival Description](https://www.loc.gov/rr/ead/) (EAD) standard for finding aids.

[__Series 2.1: Personal Correspondence__](../textfiles/xml/Series2.1.xml)

The following files are in __CSV__ format and have been extracted from the __[SPA Correspondence Sites](http://arcg.is/vOTC8)__ project.

##### Each file is a data transfer from one of the four map layers and contains the latitude and longitude for the plotted locations. (NB: Latitude and longitude are given as XY coordinates, so the 'x' column contains _longitude_ and the 'y' column contains _latitude_.)

#### Prokofiev's Outbox
##### Correspondence sent by Prokofiev

* __Prokofiev's location ([ProkSenderProkAddress.csv](../textfiles/csv/ProkSenderProkAddress.csv))__
* __Recipient's location ([ProkSenderRecipientAddress.csv](../textfiles/csv/ProkSenderRecipientAddress.csv))__

#### Prokofiev's Inbox
##### Correspondence received by Prokofiev

* __Prokofiev's location ([ProkRecipientProkAddress.csv](../textfiles/csv/ProkRecipientProkAddress.csv))__
* __Sender's location ([ProkRecipientSenderAddress.csv](../textfiles/csv/ProkRecipientSenderAddress.csv))__

---
