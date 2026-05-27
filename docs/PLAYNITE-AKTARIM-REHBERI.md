# Playnite Kütüphanesini BGaming'e Aktarma Rehberi

Bu rehber, Playnite kütüphanesindeki oyunları **Playnite Library Exporter Advanced** ile CSV dosyasına aktarıp BGaming'e güvenli biçimde içe aktarmayı anlatır.

Playnite kullanmak zorunlu değildir. BGaming; Steam'den otomatik çekme, toplu oyun ekleme ve yüklü oyun tarama yöntemlerini de destekler. Playnite aktarımı, mevcut ve düzenli bir Playnite kütüphanesi olan kullanıcılar için gelişmiş bir seçenektir.

## Aktarımda Ne Olur?

- Oyun adları, çıkış tarihi/yılı, türler, platformlar, kaynaklar ve desteklenen kullanıcı durumları BGaming'e aktarılır.
- BGaming CSV dosyasındaki Türkçe kolon adlarını okuyabilir.
- CSV ayıracı `;` veya `,` olabilir; uygulama bunu otomatik algılar.
- Aynı oyun adı daha önce BGaming'de varsa ikinci bir kart oluşturmak yerine var olan kayıt kontrol edilir.
- Var olan oyunda eksik olan platform/tür bilgileri güvenli şekilde eklenebilir.
- Playnite `Id` alanı yeniden aktarımlarda aynı kaydın çoğaltılmamasına yardımcı olur.
- Riskli benzerlikler kullanıcı onayı olmadan birleştirilmez.

## 1. Playnite'ta Library Exporter Advanced Kurulumu

1. Playnite'ı açın.
2. Sol üst menü veya eklenti yönetimi alanından **Add-ons / Eklentiler** ekranına girin.
3. Genel eklenti kataloğunda **Library Exporter Advanced** eklentisini arayın.
4. Eklentiyi kurun ve Playnite isterse uygulamayı yeniden başlatın.

Eklentinin menü konumu Playnite sürümüne göre değişebilir. Kurulumdan sonra oyun kütüphanesi ekranında dışa aktarma işlemini başlatan **Library Exporter Advanced** seçeneğini kullanın.

## 2. CSV Dosyasına Aktarılacak Alanları Seçme

Dışa aktarma ayarlarında çıktı biçimi olarak **CSV** seçin. BGaming ile en iyi sonuç için aşağıdaki alanları aktarın:

| Playnite alanı | BGaming'de kullanımı | Gerekli mi? |
| --- | --- | --- |
| `Sıralama İsmi` | Oyun adı | Evet, en güvenli başlık alanıdır |
| `Türler` | Oyun türleri | Önerilir |
| `Çıkış Tarihi` | Çıkış yılı otomatik ayıklanır | Önerilir |
| `Favori` | Favori durumu | İsteğe bağlı |
| `Kurulu` | Yüklü oyun durumu | İsteğe bağlı |
| `Tamamlanma Durumu` | Oynandı / bitti durumları | İsteğe bağlı |
| `Notlar` | Kişisel oyun notları | İsteğe bağlı |
| `Platformlar` | Steam, Epic Games, GOG vb. | Önerilir |
| `Kaynaklar` | Platform/kaynak bilgisini destekler | Önerilir |
| `Kullanıcı Puanı` | Kişisel puan, 1-10 arası | İsteğe bağlı |
| `Id` | Tekrar aktarımda kaydı tanımaya yardımcı olur | Kesinlikle önerilir |

### Oyun Adı Kolonu

BGaming aşağıdaki kolon adlarından herhangi birini oyun adı olarak tanır:

- `Sıralama İsmi`
- `İsim`
- `Oyun Adı`
- `Name`
- `Title`

CSV'de bunlardan hiçbiri yoksa uygulama hangi oyunun aktarılacağını bilemez ve anlaşılır bir hata mesajı gösterir. Playnite için en sağlam tercih **Sıralama İsmi** alanını mutlaka dışa aktarmaktır.

## 3. Playnite CSV Dosyasını Oluşturma

1. Library Exporter Advanced ekranında dosya türünü **CSV** olarak seçin.
2. Yukarıdaki alanları çıktıya ekleyin.
3. Dosya kodlaması seçilebiliyorsa **UTF-8** tercih edin. Bu, `Türler`, `Çıkış Tarihi` gibi Türkçe metinlerin bozulmamasını sağlar.
4. Ayıraç için `;` ya da `,` kullanabilirsiniz. Türkçe Windows/Excel ayarlarında `;` normaldir ve BGaming bunu destekler.
5. Dosyayı kolay bulacağınız bir konuma kaydedin; örneğin `playnite-kutuphanem.csv`.

## 4. CSV Dosyasını BGaming'e İçe Aktarma

1. BGaming'i açın.
2. **Ayarlar** sayfasına girin.
3. **İçe / Dışa Aktarma** bölümündeki **Playnite İçe Aktar** butonuna basın.
4. Playnite'tan aldığınız `.csv` dosyasını seçin.
5. Aktarma tamamlandığında ekranda sonuç özeti görünür.

Alternatif olarak kütüphane ekranındaki **Kütüphaneyi Güncelle** akışından da **Playnite İçe Aktar** seçeneğine ulaşılabilir.

## 5. BGaming'in Okuduğu Veriler

### Çıkış Tarihi

`Çıkış Tarihi` veya yıl kolonunda şu tip değerler olabilir:

- `2020`
- `2020-12-10`
- `10.12.2020`
- `12/10/2020`

BGaming bu değerlerden yılı ayıklayarak oyuna kaydeder.

### Favori ve Kurulu Bilgisi

Aşağıdaki değerler olumlu/aktif olarak okunabilir:

- `Evet`, `True`, `1`, `Yes`, `Var`

Aşağıdaki değerler kapalı/pasif olarak okunabilir:

- `Hayır`, `False`, `0`, `No`, `Yok`

### Tamamlanma Durumu

BGaming, `Tamamlanma Durumu` bilgisini olabildiğince şu durumlara çevirir:

- Tamamlanmış oyun: **Oynandı** ve **Bitti**
- Yarım bırakılmış oyun: **Oynandı**, ancak **Bitti değil**
- Oynanıyor/oynanmış oyun: **Oynandı**
- Oynanmamış oyun: ilgili durumlar kapalı

### Kişisel Puan

- `1` ile `10` arasındaki puanlar doğrudan kullanılır.
- `10` ile `100` arasındaki puanlar, gerekiyorsa 10'luk sisteme yuvarlanarak aktarılır.
- Geçersiz veya boş puanlar boş bırakılır.

### Platformlar ve Kaynaklar

BGaming yaygın platform isimlerini uygulamadaki standart adlarla eşleştirmeye çalışır. Örneğin Steam, Epic Games, GOG, Ubisoft Connect ve EA App bilgileri platform etiketlerinde kullanılır.

`Kaynaklar` alanı da platform bilgisini desteklemek için okunur. Böylece Playnite'ta oyunun hangi mağazadan geldiği yazıyorsa aktarımda kaybolmaz.

## 6. Kapak Görselleri Hakkında

Playnite export dosyasında kapak yolu varsa ve bu dosya bilgisayarınızda erişilebilir durumdaysa BGaming kapağı kendi veri klasörüne kopyalamaya çalışır.

- Kapak aktarılamazsa oyun kaydı iptal edilmez.
- Kapağı olmayan oyunlar placeholder kapakla eklenir.
- Sonradan **Koleksiyon Sağlığı** ekranından veya oyun detayındaki **Kapak Yenile** işlemiyle tamamlanabilir.

## 7. Tekrar Aktarma ve Duplicate Kontrolü

Kütüphane dosyasını daha sonra yeniden aktarmanız sorun değildir:

- Aynı `Id` ile gelen Playnite kaydı ikinci kez oluşturulmaz.
- Aynı normalize edilmiş oyun adı bulunursa gereksiz yeni kart eklenmez.
- Yeni bir platform bilgisi geldiyse mevcut oyuna eklenebilir.
- Emin olunamayan benzer kayıtlar otomatik birleştirilmez; **Koleksiyon Sağlığı** ekranında kullanıcının kontrolüne sunulabilir.

Bu davranış, farklı platformlardaki aynı oyunun yanlışlıkla veri kaybettirecek şekilde birleştirilmesini önler.

## 8. Aktarım Sonucu Özetini Okuma

Aktarım tamamlandığında BGaming şu sayıları gösterebilir:

- **Eklenen oyun:** Kütüphaneye yeni eklenen kayıtlar.
- **Zaten vardı:** Daha önce mevcut olduğu için yeni kart oluşturulmayanlar.
- **Platformu güncellenen:** Var olan oyuna yeni platform bilgisi eklenenler.
- **Atlanan satır:** Oyun adı bulunamayan veya kullanılamayan satırlar.
- **Hatalı satır:** Okuma sırasında sorun yaşanan kayıtlar.
- **Duplicate şüphesi:** Kontrol edilmesi gereken benzer oyunlar.

## 9. Sorun Giderme

### "Oyun adı kolonu bulunamadı" hatası

CSV çıktı alanlarına `Sıralama İsmi` ekleyip dosyayı yeniden dışa aktarın.

### Türkçe karakterler bozuk görünüyor

Playnite export ayarlarında dosyayı **UTF-8** kodlaması ile oluşturun ve yeniden içe aktarın.

### Bazı platformlar gelmedi

Dışa aktarım alanlarına hem `Platformlar` hem de `Kaynaklar` kolonlarını ekleyin.

### Kapaklar eksik kaldı

Kapak yolu export dosyasında bulunmuyor veya eski dosyaya erişilemiyor olabilir. Oyunu BGaming içinde açıp **Kapak Yenile** kullanabilir ya da **Koleksiyon Sağlığı** ekranından toplu tamamlama deneyebilirsiniz.

### Aynı oyun iki kez görünüyor

Oyunlar farklı adlarla aktarılmış olabilir. **Koleksiyon Sağlığı > Duplicate şüpheli oyunlar** bölümünden kayıtları inceleyip kullanıcı onayıyla birleştirebilirsiniz.

## Gizlilik Notu

BGaming, Playnite aktarımı için yalnızca sizin seçtiğiniz dışa aktarma dosyasını okur. Epic Games, GOG, Ubisoft Connect, EA App veya Amazon hesap şifrenizi istemez. GitHub'da paylaşılan kurulum dosyasının içinde sizin yerel oyun kütüphaneniz, kapak klasörünüz, Steam API Key'iniz veya kişisel ayarlarınız bulunmaz.
