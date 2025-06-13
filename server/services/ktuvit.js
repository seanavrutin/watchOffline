const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const axios = require('axios').default;
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));
const headers = {
    'Content-Type': 'application/json'
};

class Ktuvit {
    static async getSubtitles(imdbID,title,year,season, episode,isSeries) {
        await client.get('https://www.ktuvit.me');
        await client.post('https://www.ktuvit.me/Services/MembershipService.svc/Login', {
            request: {
                Email: "seanavrutin@gmail.com",
                Password: "oh330hb37TpciHyiqHFcFP1G15nAl9Al2qwtTQ0+fos="
            }
        },headers);

        let filmID = await this.getFilmID(imdbID,title,year,season, episode,isSeries);

        if(!filmID){
            return undefined;
        }

        let subtitles = isSeries ? await this.getSubtitlesForSeries(filmID,season,episode) : await this.getSubtitlesForMovie(filmID);

        for(let subtitle of subtitles){
            


        }

        return subtitles;
    }

    static async getFilmID(imdbID,title,year,isSeries){
        const searchType = isSeries ? '1' : '0';
        const searchBody = {
            request: {
                FilmName: title,
                Actors: [],
                Studios: null,
                Directors: [],
                Genres: [],
                Countries: [],
                Languages: [],
                Year: year ? String(year) : '',
                Rating: [],
                Page: 1,
                SearchType: searchType,
                WithSubsOnly: false
            }
        };

        const searchRes = await client.post('https://www.ktuvit.me/Services/ContentProvider.svc/SearchPage_search', searchBody, headers);

        const parsed = JSON.parse(searchRes.data.d);
        const film = parsed.Films.find(f => f.ImdbID === imdbID || f.IMDB_Link.includes(imdbID));
        if (!film) return undefined;
        return film.ID;
    }

    static async getSubtitlesForSeries(filmID, season, episode){
        const subtitleUrl = `https://www.ktuvit.me/Services/GetModuleAjax.ashx?moduleName=SubtitlesList&SeriesID=${filmID}&Season=${season}&Episode=${episode}`;

        const htmlRes = await client.get(subtitleUrl, { headers });
        const $ = cheerio.load(`<table>${htmlRes.data}</table>`);
        const subtitles = [];

        $('tr').each((_, row) => {
            const name = $(row).find('td div').first().text().split('תרגום:')[0].trim();
            const id = $(row).find('[data-subtitle-id]').attr('data-subtitle-id');
            if (name && id) {
                subtitles.push({
                    attributes:{
                        language: "he",
                        release: name,
                        ktuvit_id: id,
                        filmID: filmID
                    }
                })
            }
        });

        return subtitles;
    }

    static async getSubtitlesForMovie(filmID){

        const res = await client.get(`https://www.ktuvit.me/MovieInfo.aspx?ID=${filmID}`, { headers });
        const $ = cheerio.load(res.data);
        const subtitles = [];
    
        $('#subtitlesList tbody tr').each((_, row) => {
          const name = $(row).find('td').eq(0).find('div[style*="95%"]').contents().first().text().trim();
          const subID = $(row).find('[data-subtitle-id]').attr('data-subtitle-id');
          if (name && subID) {
            subtitles.push({
                attributes:{
                    language: "he",
                    release: name,
                    ktuvit_id: subID,
                    filmID: filmID
                }
            })
          }
        });
    
        return subtitles;
    }

    static async downloadSubtitle(filmID,ktuvit_id){
        let downloadBody = {
            request: {
                FilmID: filmID,
                SubtitleID: ktuvit_id,
                FontSize: 0,
                FontColor: "",
                PredefinedLayout: -1
            }
        }
        const requestDownloadRes = await client.post('https://www.ktuvit.me/Services/ContentProvider.svc/RequestSubtitleDownload', downloadBody, headers);
        const parsed = JSON.parse(requestDownloadRes.data.d);
        await new Promise(resolve => setTimeout(resolve, parsed.ValidIn * 1000));
        const downloaded = await client.get("https://www.ktuvit.me/Services/DownloadFile.ashx?DownloadIdentifier="+parsed.DownloadIdentifier, { headers,responseType: 'arraybuffer' });

        return downloaded;
    }
}

module.exports = Ktuvit;