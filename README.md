# Lodní deník

Digitální lodní deník pro členy Námořního klubu. Plavby, denní etapy, souhrn praxe (NM, dny na moři, NM jako kapitán) a export do Excelu. Funguje offline a instaluje se z webu na plochu telefonu.

## Sestavení

Potřebujete jen [Node.js](https://nodejs.org) (verze LTS).

```
node build.mjs
```

Výsledek je ve složce `dist/lodni-denik`. Tu nahrajte na web (návod je v `JAK-NAINSTALOVAT.txt`).

## Test exportu

```
node tools/test-export.mjs
```
