
case $* in
debian)
apt-get install gcc make glib2-devel libcurl-devel openssl-devel gmp-devel tar libffi-devel gettext-devel -y

wget https://megatools.megous.com/builds/megatools-1.9.97.tar.gz
tar xvzf megatools-1.9.97.tar.gz
cd megatools-1.9.97
./configure

echo "[Login]
Username = $*
Password = $*
" > ~/.megarc

chmod 600 ~/.megarc

mkdir glib-source
cd glib-source/  
wget http://ftp.gnome.org/pub/GNOME/sources/glib/2.32/glib-2.32.4.tar.xz  
tar xvf glib-2.32.4.tar.xz  
cd glib-2.32.4/  
./configure #--prefix=/usr/local/glib-2.32
make  
make install  
;;
centos)
yum install gcc make glib2-devel libcurl-devel openssl-devel gmp-devel tar libffi-devel gettext-devel -y

wget https://megatools.megous.com/builds/megatools-1.9.97.tar.gz
tar xvzf megatools-1.9.97.tar.gz
cd megatools-1.9.97
./configure

echo "[Login]
Username = $*
Password = $*
" > ~/.megarc

chmod 600 ~/.megarc

mkdir glib-source
cd glib-source/  
wget http://ftp.gnome.org/pub/GNOME/sources/glib/2.32/glib-2.32.4.tar.xz  
tar xvf glib-2.32.4.tar.xz  
cd glib-2.32.4/  
./configure #--prefix=/usr/local/glib-2.32
make  
make install  
;;
esac
