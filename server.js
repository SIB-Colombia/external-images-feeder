var http = require("http");
var pg = require("pg");
var request = require("request");

var Flickr = require("flickrapi"),
 flickrOptions = {
      api_key: "d70bb0faa317f97f15ecf636ee77c33e",
      secret: "e7d0dd63c288cb8b"
    };

var conString = {
      user: "postgres",
      password: "password",
      database: "catalogo",
      host: "localhost",
      port: 5432
    };
 
function list_elements(callback) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
        if (err) {
            callback(null, err);
        } else {
                client.query("SELECT taxonnombre FROM pcaat_ce where taxonnombre not in('','null') group by taxonnombre order by taxonnombre desc;",callback);
        }
    });
}

 function eol_connect(taxonnombre){
    if(taxonnombre!=null){
        console.log("Searching for eol images of " + taxonnombre);
        request({
            url: "http://eol.org/api/search/1.0.json?q="+encodeURIComponent(taxonnombre)+"&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl=",
            method: "GET",
            json: true
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                if(body.totalResults > 0) {
                    console.log("We can find some images for ... " + taxonnombre);
                    body.results.forEach(function(result_id) {
                        request({
                            url: "http://eol.org/api/pages/1.0/"+result_id.id+".json?images=10&videos=0&sounds=0&maps=0&text=0&iucn=false&subjects=overview&licenses=all&details=true&common_names=false&synonyms=false&references=false&vetted=0&cache_ttl=",
                            method: "GET",
                            json: true
                        }, function(error_1, response_1, body_1) {
                                if (!error_1 && response_1.statusCode == 200) {
                                    if(body_1.dataObjects.length > 0) {
                                        console.log("Found additional information for ..." + taxonnombre);
                                        body_1.dataObjects.forEach(function(result_data) {
                                            var handleError = function(err) {
                                              if(!err) return false;
                                              console.log("An error occurred for a eol row");
                                              return true;
                                            };
                                            pg.connect(conString, function(err, client_row, done) {
                                                var handleError = function(err) {
                                                  if(!err) return false;
                                                  done(client_row);
                                                  console.log("An error occurred for a eol row");
                                                  console.log(err);
                                                  return true;
                                                };
                                                var url = '';
                                                var source = '';
                                                if(typeof  result_data.eolMediaURL != 'undefined'){
                                                    url =(result_data.eolMediaURL).replace(/'/g, "\''");
                                                }
                                                if(typeof  result_data.source != 'undefined'){
                                                    source =(result_data.source).replace(/'/g, "\''");
                                                }
                                                client_row.query("INSERT INTO external_images(taxonnombre,imageUrl,imageLicense,imageRights,imageRightsHolder,imageSource) VALUES ('" + taxonnombre +"','"+ url +"','"+ result_data.license +"','"+ result_data.rights +"','"+ result_data.rightsHolder +"','"+source + "');", function(err, result) {
                                                if(handleError(err)) return;
                                                done();
                                                console.log("Row created into external_images")
                                            });
                                        });
                                    });
                                }
                            }    
                        });
                    });
                } else{
                    console.log("We can't find any image for..." + taxonnombre);
                }  
            }
        });
    }
}

function flickr_connect(taxonnombre){
    if(taxonnombre!=null){
        console.log("Searching for flickr images for " + taxonnombre);
        Flickr.tokenOnly(flickrOptions, function(error, flickr) {
            flickr.photos.search({
              group_id: "2287605@N22",
              json: true,
              text: taxonnombre
            },function(err,body) {
                if(!err && body.stat == "ok"){
                    if(body.photos.total > 0) {
                        console.log("We can find some images for ... " + taxonnombre);
                        body.photos.photo.forEach(function(photo) {
                            var id = photo.id;
                            flickr.photos.getInfo({
                              json: true,
                              photo_id: id
                            },function(error_1, body_1) {
                                if (!error_1 && body_1.stat == "ok") {
                                    console.log("Found additional information for ..." + taxonnombre);
                                    var license;
                                    if(body_1.photo.id!=null) {
                                        switch(body_1.photo.license){
                                            case "0":
                                                license = "All Rights Reserved";
                                                break;
                                            case "1":
                                                license = "http://creativecommons.org/licenses/by-nc-sa/2.0/";
                                                break;
                                            case "2":
                                                license = "http://creativecommons.org/licenses/by-nc/2.0/";
                                                break;
                                            case "3":
                                                license = "http://creativecommons.org/licenses/by-nc-nd/2.0/";
                                                break;
                                            case "4":
                                                license = "http://creativecommons.org/licenses/by/2.0/";
                                                break;
                                            case "5":
                                                license = "http://creativecommons.org/licenses/by-sa/2.0/";
                                                break;
                                            case "6":
                                                license = "http://creativecommons.org/licenses/by-nd/2.0/";
                                                break;
                                            case "7":
                                                license = "http://flickr.com/commons/usage/";
                                                break;
                                            case "8":
                                                license = "http://www.usa.gov/copyright.shtml";
                                                break;
                                        } 
                                        flickr.photos.getSizes({
                                          json: true,
                                          photo_id: id
                                        },function(error_2, body_2) {
                                            if (!error_2 && body_2.stat == "ok") {
                                                console.log("Found additional information about sizes for ..." + taxonnombre);
                                                pg.connect(conString, function(err, client_row, done) {
                                                    var handleError = function(err) {
                                                      if(!err) return false;
                                                      done(client_row);
                                                      console.log("An error occurred for a flickr row");
                                                      console.log(err);
                                                      return true;
                                                    };
                                                    var url ='';
                                                    if(typeof  body_2.sizes.size[5].source != 'undefined'){
                                                        url =(body_2.sizes.size[5].source).replace(/'/g, "\''");
                                                    }
                                                    client_row.query("INSERT INTO external_images(taxonnombre,imageUrl,imageLicense,imageRights,imageRightsHolder,imageSource) VALUES ('" + taxonnombre +"','"+ url +"','"+ license +"','"+ body_1.photo.owner.realname+"','"+ body_1.photo.owner.realname+"','"+ url +"');", function(err, result) {
                                                        if(handleError(err)) return;
                                                        done();
                                                        console.log("Row created into external_images")
                                                    });
                                                });
                                            }
                                        });
                                     }
                                }
                            });
                        });
                    }else{
                        console.log("We can't find any image for..." + taxonnombre);
                    }  
                }
            });
        });
    }
}

function write_response(result) {
    result.rows.forEach(function(row) {
        if(row!=null){
            taxonnombre = row.taxonnombre.replace(/^\s+|\s+$/g, "");
            console.log(taxonnombre);
            eol_connect(taxonnombre);
            flickr_connect(taxonnombre);
        }
    });
}


 
var main = function() {
    pg.connect(conString, function(err, client, done){
        if(client!=null){
            var handleError = function(err) {
            if(!err) return false;
            done(client);
            console.log(500, {"content-type": "text/plain"});
            console.log("The table external_images does not exist");
            return true;
            };
            client.query("DELETE FROM external_images;", function(err, result) {
                if(handleError(err)) return;
                list_elements(function(err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        write_response(result); 
                        console.log("Terminamos....")
                    }
                });
            });
        }else{
            console.log(err)
        }
        done();
    });    
};
 
main();