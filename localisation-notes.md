What needs to be translated:
  Filter Menu
    (later): Informational Texts about each Category/Type of Initiative
  Random Strings (headings, like e.g. "Address" in the popups)
    If it is a common thing, use Wikidata?
    fall back to Weblate?

  In the Popup: -OK
    description of initiative in different language

Weblate
  can be used with Github directly
    its ssh-key must be added (to repo?)
      (and user configured?
    github host key in Weblate -OK and checked
    create project -OK
      creating component
        Failed to fetch repository: Could not create directory '/home/weblate/.ssh

    difference bilingual/monolingual?
      only monolingual supported with JSON

  format

filename called json/$LANGCODE.json, e.g. de.json
  content:
    {
      "English Text %d" : "Deutscher Text",
      "stuff" : ""
    }
      

We need a language switcher -OK
  that is set first on
    the user's preferred language
    can be set manually to any lang
      which langs do we support?
      should be generated out of
        https://base.transformap.co/wiki/Special:EntityData/Q5.json .entities.P5.labels.$keys

  design: flag symbol, 
    on hover open sidewards to display language string
    on click open downwards to choose lang from ... how many?
      mobile: open full-screen

  Flag symbol:
    get "en" -> Wikidata -> get country -> get flag?
      is P31 of Q34770 (Einzelsprache)
      P218 is "de"
      gib mir P495 (ursprungsland) 
      -> P41 (Flagge)

      wir wollen: Text und Link zur Flatte
        intermediate vars:
          Ursprungsland
          Sprachobjekt

      1. query:
        return Ursprungsland of lang object with Lang Label
      2. query
        return P41 of Ursprungsland
     ==> http://tinyurl.com/zvnb3tw
          -> funktionierte GENAU bei deutsch, da nur bei 3 Ursprungsland gesetzt ist und nur DE die Flagge gesetzt hat
      Wir können zumindest die Namen der Anderen Sprachen in Landessprache Anzeigen?
        bringt das was, wenn sich wer verklickt hat sieht er die anderen auch  in Farsi? -> blöd
        Alle Labels in En?
        Besser: Alle Labels in ihrer eigenen Sprache!
        -> sind dann N queries? oder lassen sich die in eine tun...
          oder alle Labels in Englisch?

        Hm ... es wär blöd flaggen für Sprachen zu verwenden, die in mehreren Ländern gesprochen werden ... die sich Ev. nicht mögen.
          Und es gibt wohl keine offiziellen Flaggen pro Sprache
        -> garkeine Flaggen verwenden, nur die Namen!

https://query.wikidata.org/bigdata/namespace/wdq/sparql?query=%23language%20and%20flags%0ASELECT%20%3Flang%20%3FlangLabel%20%3Fkuerzel%0AWHERE%0A%7B%0A%20%20%3Flang%20wdt%3AP218%20%3Fkuerzel%3B%0A%20%20FILTER%20regex%20(%3Fkuerzel%2C%20%22%5E(de%7Cfr%7Cen)%24%22).%0A%20%20%20%20%20%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22.%20%7D%0A%7D%0AORDER%20BY%20%3Flang


We have fallback languages -OK
  e.g. de_AT -> de -> en (en is always last)

Put such option in a menu for mobile (=) ?
  or disable althogether?


