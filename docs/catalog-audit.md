# HDML Catalog Audit Report

Generated: 2026-07-17T11:54:58.700Z · Source: `data/catalog_source.csv`

## Source data

| Metric | Value |
|---|---|
| Source rows | 10329 |
| Distinct names | 9035 |
| Distinct (name, price) combinations | 9082 |
| Exact duplicate rows collapsed | 1247 |
| Price range (EGP) | 12.00 – 138499.00 |

## Import decisions

| Outcome | Count |
|---|---|
| Products created (total) | 9082 |
| Active immediately | 8791 |
| Inactive, needs review | 291 |
| Newly inserted this run | 0 |

Products are **never merged silently**: names with conflicting prices are kept as separate inactive variants for manual review. Re-running the import is idempotent — existing SKUs are left untouched (admin edits preserved).

## Names with conflicting prices (32)

| Product name | Source rows | Distinct prices (EGP) |
|---|---|---|
| 2 In 1 Wireless Carplay & Android Auto Adapter Converts Factory Wired Carplay… | 2 | 1399.00, 1499.00 |
| 2Pack 4 In 1 Fast Charging Cable, Transferring Data, 6.65 Ft, Braided Cable 6… | 2 | 79.00, 161.60 |
| 4 X 100Ml Universal Ink Refills For Epson Canon Hp Brother Lexmark Dell Kodak… | 2 | 220.00, 225.00 |
| 4 X 100Ml Universal Refill Ink Kit For Epson Canon Hp Brother Lexmark Dell Ko… | 2 | 220.00, 260.00 |
| Afrutto - Bm10 Dual Sim Mobile Phone - Mini Afrto - Multi Color | 2 | 699.00, 749.00 |
| Air Buds Pro Compatibal With iPhone Wireless Earbuds Bluetooth Headphones Wit… | 2 | 315.00, 499.00 |
| Case Cover Compatible With Xiaomi Pad 7/7 Pro, Slim Lightweight Cover With Pe… | 2 | 489.50, 571.99 |
| Cellular_Phone_Case | 100 | 493.95, 1995.00 |
| Dslr Camera Bag Photo Bag For Canon Eos 1100D 700D 650D 600D 550D For Nikon P… | 2 | 255.00, 266.00 |
| Electronic_Cable | 239 | 88.00, 99.00, 119.00, 125.00, 125.50, 175.00, 224.00, 280.00, 288.00, 310.00, 324.00, 379.00, 430.00, 450.00, 629.99, 650.00 |
| Energy Case Laptop Backpack Case,17 Inch Business Travel Backpack Water Resis… | 2 | 334.40, 554.40 |
| Gaming Mouse Pad, Extra Large Mouse Mat Xxl 900 X 400mm, Extended Mousepad Wi… | 3 | 250.00, 299.00 |
| Gang Bag Case Laptop Backpack, Waterproof Backpack, Large Capacity Backpack F… | 2 | 269.10, 299.00 |
| Headphones | 2 | 139.51, 2769.00 |
| Jbl Flip 7 - Portable Waterproof And Drop-Proof Speaker, Bold Pro Sound With … | 3 | 5400.00, 5698.00, 5970.00 |
| Jbl Tune 520Bt Wireless On-Ear Headphones, Pure Bass Sound, 57H Battery With … | 2 | 1989.00, 2080.00 |
| Lezoy Laptop Backpack With Large Storage Capacity & Multiple Pockets, Waterpr… | 2 | 594.99, 674.99 |
| Logitech M240 Silent Bluetooth Mouse, Wireless, Compact, Portable, Smooth Tra… | 2 | 889.00, 990.00 |
| Next Store Compatible With Huawei Watch Fit 4 Adjustable Fashion Metal Replac… | 2 | 133.00, 190.00 |
| Pro2Plus Noise Cancelling Earphones Comfortable Earbuds, High-Quality Materia… | 2 | 450.00, 525.00 |
| Rechargeable 3.7V Lithium Battery For ., Flashlights, E-Bikes, Toys \| ¨·§±Ùš©… | 2 | 94.50, 112.50 |
| Smart Watches For Women(Answer/Make Call),1.19" Amoled Fitness Watch, Heart R… | 2 | 3500.00, 3799.00 |
| Soundcore C30I By Anker, Open-Ear Earbuds, Clip-On Headphones, Lightweight Co… | 2 | 1899.00, 2222.00 |
| Stylus Pen For Android Touch Screens,Stylus Pencil For Tablet,Stylus Compatib… | 2 | 322.00, 399.00 |
| Tk63 Wireless Keyboard Bluetooth/2.4G/USB Wired 60% Mechanical Gaming Keyboar… | 2 | 1112.00, 1123.00 |
| Total Rapid Battery Charger (Tfcli2001) | 2 | 440.41, 460.00 |
| Tp-Link Re315 Ac1200 Mesh Wi-Fi Range Extender | 2 | 1488.00, 1780.00 |
| Varta Varta German Hearing Aid Batteries Newest Generation Super Power Hearin… | 2 | 158.12, 176.99 |
| Victoria AI Mohandes Corded Telephone - 200A | 2 | 390.10, 439.00 |
| Wifi Video Projector, Wewatch V10 Wireless Portable Movie Projector With Blue… | 4 | 3359.00, 3799.00 |
| Wisme Ws10 Smart Watch With Sim And Built-In Camera Enjoy An Integrated Exper… | 2 | 3449.00, 4000.00 |
| ´¨Ùƒ© Ù…±¨¹Ù‡ Ù„Ù„³ÙˆÙª ¨ÙˆÙƒ³ Ù…Ù‚§³ 50 * 70 ³Ù…, Ù„ª³·Ùš §Ù„¶Ùˆ¡ Ùˆ££¹Ù„Ù‰ … | 2 | 210.00, 214.00 |

## Review flags

| Flag | Names affected | Meaning |
|---|---|---|
| generic_name | 44 | Underscore-style generic title (may represent several real products) |
| corrupted_text | 166 | Mojibake — Arabic text corrupted at export time; needs manual renaming |
| very_short_name | 8 | Name too short to identify the product |

### generic_name — sample

- (Hot 50I Smart 9) Shockproof Liquid Silicone Back Case Cover With Fur Lined Interior And Full Camera Cover For Infinix Hot 50I_ Smart 9 (Black)
- (Realme C53_Realme C51_ Realme Note 50) Soft Tpu Slim Protective Cover With Card Holder For Realme C53 Realme C51 Realme Note 50
- (Samsung Galaxy A12_M12_F12) Clear Case, Slim Design, Flexible Tpu Shockproof Corners, Phone Case For Samsung Galaxy A12_M12_F12 (Clear)
- (Samsung Galaxy A12_M12_F12) Flip Wallet Leather Case Cover Compatible With Samsung Galaxy A12_M12_F12 (Black)
- Case Compatible With Realme 14_ 14T 5G Clear Case Soft Tpu Silicone Bumper Reinforced Corner Full Camera Protection Transparent Cover
- Case For Vivo V21E_V20_ Y73 Clear Case Soft Tpu Silicone Bumper Reinforced Corner Bumper Transparent Cover
- Cellular_Phone_Case
- Crucial_Ssd Storage-Sata 3-2.5"Bx500-240GB
- Crucial_Ssd Storage-Sata 3-2.5"Bx500-500GB
- El_Gawal For Smart Case Cover For Huawei Matepad T10S / T10 (10.1 Inch) T 10S Stand, For Tablets, Polyester (Black)
- Electronic_Cable
- Fekra For Airpods Pro 3 2025 Case Cover, Cute Flower Engraved Case For Apple Airpods Pro 3Rd Gen 2025, Silicone Protective Shockproof Cover With Keychain (F_Grey), Airpods Pro 3 (2025))
- Fekra For Airpods Pro 3 2025 Case With Lock Clip, Rugged Apple Airpods Pro 3 2025 Generation Cover 3Rd Men Women, Armor Shockproof Ipod Pro3 Gen Protective Hard Shell With Carabiner (F_Lock Black)
- Fekra For Airpods Pro 3 2025 Case: Compatible With Airpods Pro 3 Gen (2025), Drop Protection Cover With Keychain, Litchi Faux Leather, Shock-Proof Protective Tpu Case (F_Black)
- Fekra Leather Case Compatible For iPhone 17 Pro Max Shockproof Leather Back Card Storage & Case Built-In Stand Pu Leather For A Stylish Look, Comfortable Grip (F_Black)
- …and 29 more

### corrupted_text — sample

- 10 Nfc Cards ¹¯¯ 10 Ùƒ±Ùˆª §Ù† §Ù ³Ù‰
- 7 Port USB 3.0 Hub Ï¼ˆ12V 2A Power Supplyï¼‰
- Aimery Active Stylus Pen For Touchscreen Android iPhone Tablet Phoneï¼Œtouch Screen Pen For iPhone/iPad/Pencil/Samsung/Ios/Lenovo/Huawei/Vivo - White
- Anna Is War Series - Because She Kiara - Kingdom Of Nightmares And Fog - Black Throne Ù„£Ù†Ù‡§ Ùƒùš§±§ - Ù…Ù…Ù„Ùƒ© §Ù„Ùƒùˆ§¨Ùš³ Ùˆ§Ù„¶¨§¨ - §Ù„¹±´ §Ù„£³Ùˆ¯ ³Ù…§ ³§Ù…Ùš
- Anoowkoa Designed For Samsung Galaxy A16 5G Caseï¼ˆAnti Yellowingï¼‰ Clear Phone Case.Military-Grade Shockproof.Ultra-Thin. For Galaxy A16 5G Clear Phone Case
- Anoowkoa Designed For Samsung Galaxy A26 5G Case Clear Galaxy A26 5G Cover Phone Caseï¼ˆAnti Yellowingï¼‰[Military-Grade Shockproof ].Ultra-Thin .Drop-Proofï¼ˆTransparentlyï¼‰
- Anrdoid 12, Smart Carplay Video Box With Netflix Youtube Support, Wireless/USB, Android Auto Apple Car Play, Wi-Fi & Bluetooth, Gt4S Model ­ÙˆÙ„ ´§´© ¹±¨Ùšªùƒ Ù„ Android 12 Ù…¹ ¬Ù‡§² §Ù„³Ùš§±© §Ù„³Ù…§±ª §Ù„¬¯Ùš¯
- Aqqa Chmij Large Mouse Pad Matã¯¼Ë†11.8X31.5 In Extended Gaming Mouse Pad With Non-Slip Rubber Base,Background Topographic Map Lines Contour Geographic For Gaming Office Laptop Computer Men Women
- Arabic Keyboard Sticker - Clear Transparent Glossy Overlay | Ã™€¦Ã™€Žµã™€Š Ã™€Žã™Ë†­© Ã™€¦Ù§ªã™Å ­ ¹±¨Ã™Å  ´Ù§Ù Ã™€Žã™€¦§¹ | Easy To Apply, Durable, And Compatible With All Keyboards (White)
- Asus Tuf Gaming [Fa401Uu-Rg028W] Amd Ryzenâ„¢ 7 8845Hs / Lpddr5X 16GB / 512GB Ssd/Rtxâ„¢ 4050 6GB / Win 11
- Asus Vivobook S 15 Oled S5507Qa#B08H1Gnqw9 Aluminium Notebook With 15.6" Gloss Monitor, 120Hz, Snapdragonâ® X Plus Processor, 16GB Ram, 512GB Ssd Pcie, Qualcommâ® Adrenoâ„¢ Gpu, Win 11 Home, Silver
- Baseus Elf Digital Display Fast Charge Power Bank 10000mAh 22.5W Purpleï¼ˆ*Ï¼‰
- Canon Rf 24 105mm F4L Is Usm Lensœ Professional L Seriesœ Nano Usmœ 5 Stop Image Stabilizerœ Great For Portraitœ Travel & Landscape, Black
- Compatible With Airtag Case Keychain Air Tag Holder Silicone Airtags Key Ring Cases Tags Chain Apple Airtag Gps Item Finders Accessoriesï¼Œblack
- Darkness Red Moon Schreibtischunterlage, Japanisches Mauspad, Groãÿe Kirschblã¼Ten-Schreibtischmatte, Xl-Anime-Gaming-Tastaturmatte, Rutschfeste Gummiunterseite, Groãÿer Erweiterter Schreibtischschutz
- …and 151 more

### very_short_name — sample

- At9 (Black)
- Ch9 Wca
- Dad I Hate
- Headphones
- Hp Pen
- Power_Bank
- S4040 V2
- Scope S2030

## Category distribution (deterministic keyword rules)

| Category | Products |
|---|---|
| cases-protection | 2531 |
| chargers-power | 1030 |
| computer-peripherals | 822 |
| earbuds-headphones | 805 |
| other | 735 |
| cables-adapters | 581 |
| storage-memory | 370 |
| phone-accessories | 337 |
| speakers-audio | 312 |
| networking | 246 |
| wearables | 246 |
| tv-video | 224 |
| batteries | 213 |
| cameras-photography | 194 |
| laptops-bags | 114 |
| gaming | 80 |
| computers | 79 |
| tablets-ereaders | 79 |
| smartphones | 77 |
| smart-home | 7 |

## Brand inference

Detected brands (top 25 of 104); 4337 products have no recognized brand.

| Brand | Products |
|---|---|
| Samsung | 1020 |
| Apple | 343 |
| Xiaomi | 295 |
| Huawei | 253 |
| Honor | 234 |
| Oppo | 168 |
| Ugreen | 164 |
| HP | 132 |
| Joyroom | 124 |
| Realme | 115 |
| Soundcore | 109 |
| Logitech | 91 |
| Redmi | 88 |
| Lenovo | 87 |
| Redragon | 87 |
| TP-Link | 83 |
| Anker | 80 |
| Dell | 79 |
| Infinix | 74 |
| Camelion | 66 |
| Canon | 61 |
| JBL | 59 |
| Oraimo | 49 |
| Asus | 42 |
| Ldnio | 41 |

Category and brand values are marked `category_inferred` / `brand_inferred` in the database and can be corrected in the admin panel.
